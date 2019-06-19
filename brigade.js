const { events, Job, Group } = require("brigadier");

const projectName = "brigadecore-charts";
const sharedMountPrefix = `/mnt/brigade/share`;

const releaseTagRegex = /^refs\/tags\/([A-Za-z0-9\-]+)\-v([0-9]+(?:\.[0-9]+)*(?:\-.+)?)$/

class HelmJob extends Job {
  constructor (name) {
    super(name);
    this.image = "dtzar/helm-kubectl:2.14.1";
    this.imageForcePull = true;
    this.tasks = [
      "apk upgrade 1>/dev/null",
      "apk add --update --no-cache make 1>/dev/null",
      "cd /src"
    ]
  }
}

function test(e, project) {
  var tester = new HelmJob(`${projectName}-test`);

  tester.tasks.push(
    "make test"
  );

  return tester;
}

function build(e, project, chartName, chartVersion) {
  var builder = new HelmJob(`${projectName}-build`);
  builder.storage.enabled = true;

  builder.tasks.push(
    "helm init -c",
    // Needed for fetching brigade's sub-charts (kashti, etc.)
    "helm repo add brigade https://brigadecore.github.io/charts",
    `echo "Building chart: ${chartName} with version: ${chartVersion}"`,
    `CHART=${chartName} VERSION=${chartVersion} make build`,
    `curl -o dist/index.yaml https://raw.githubusercontent.com/${project.repo.name}/gh-pages/index.yaml`,
    `make index`,
    `cp -a dist/ ${sharedMountPrefix}`
  );

  return builder;
}

function publish(e, project) {
  var publisher = new Job(`${projectName}-publish`, "node");
  publisher.storage.enabled = true;

  publisher.tasks = [
    "npm install -g gh-pages",
    "cd /src",
    `cp -a ${sharedMountPrefix}/dist .`,
    `gh-pages --add -d dist \
      -r https://brigadeci:${project.secrets.ghToken}@github.com/${project.repo.name}.git \
      -u "Brigade CI <brigade@ci>" \
      -m "Add chart artifacts and update index.yaml"`
  ];

  return publisher;
}

function runSuite(e, p) {
  // Ignore webhook event if originating from the `gh-pages` branch serving chart artifacts
  // (Builds would just fail as no brigade.js file exists on this branch)
  if (! e.revision.ref.includes("gh-pages")) {
    return runTests(e, p);
  }
}

function runTests(e, p) {
  console.log("Check requested");

  // Create Notification object (which is just a Job to update GH using the Checks API)
  var note = new Notification(`tests`, e, p);
  note.conclusion = "";
  note.title = `Run tests`;
  note.summary = `Running the test targets for ${e.revision.commit}`;
  note.text = "This task will ensure linting and tests pass.";

  // Send notification, run actual task, then send pass/fail notification
  return notificationWrap(test(e, p), note);
}

// runCheck is the default function invoked on a check_run:* event
//
// It determines which check is being requested (from the payload body)
// and runs this particular check, or else throws an error if the check
// is not found
function runCheck(e, p) {
  payload = JSON.parse(e.payload);

  // Extract the check name
  name = payload.body.check_run.name;

  // Determine which check to run
  switch(name) {
    // This project currently has this one check for running tests
    case "tests":
      return runTests(e, p);
    default:
      throw new Error(`No check found with name: ${name}`);
  }
}

// handleIssueComment handles an issue_comment event, parsing the comment text
// and determining whether or not to trigger an action
function handleIssueComment(e, p) {
  console.log("handling issue comment....")
  payload = JSON.parse(e.payload);

  // Extract the comment body and trim whitespace
  comment = payload.body.comment.body.trim();

  // Here we determine if a comment should provoke an action
  switch(comment) {
    // Currently, the do-all '/brig run' comment is supported,
    // for (re-)triggering the default Checks suite
    case "/brig run":
      return runSuite(e, p);
    default:
      console.log(`No applicable action found for comment: ${comment}`);
  }
}

// A GitHub Check Suite notification
class Notification {
  constructor(name, e, p) {
    this.proj = p;
    this.payload = e.payload;
    this.name = name;
    this.externalID = e.buildID;
    this.detailsURL = `https://brigadecore.github.io/kashti/builds/${ e.buildID }`;
    this.title = "running check";
    this.text = "";
    this.summary = "";

    // count allows us to send the notification multiple times, with a distinct pod name
    // each time.
    this.count = 0;

    // One of: "success", "failure", "neutral", "cancelled", or "timed_out".
    this.conclusion = "neutral";
  }

  // Send a new notification, and return a Promise<result>.
  run() {
    this.count++
    var j = new Job(`${ this.name }-${ this.count }`, "brigadecore/brigade-github-check-run:latest");
    j.imageForcePull = true;
    j.env = {
      CHECK_CONCLUSION: this.conclusion,
      CHECK_NAME: this.name,
      CHECK_TITLE: this.title,
      CHECK_PAYLOAD: this.payload,
      CHECK_SUMMARY: this.summary,
      CHECK_TEXT: this.text,
      CHECK_DETAILS_URL: this.detailsURL,
      CHECK_EXTERNAL_ID: this.externalID
    }
    return j.run();
  }
}

// Helper to wrap a job execution between two notifications.
async function notificationWrap(job, note, conclusion) {
  if (conclusion == null) {
    conclusion = "success"
  }
  await note.run();
  try {
    let res = await job.run()
    const logs = await job.logs();

    note.conclusion = conclusion;
    note.summary = `Task "${ job.name }" passed`;
    note.text = note.text = "```" + res.toString() + "```\nComplete";
    return await note.run();
  } catch (e) {
    const logs = await job.logs();
    note.conclusion = "failure";
    note.summary = `Task "${ job.name }" failed for ${ e.buildID }`;
    note.text = "```" + logs + "```\nFailed with error: " + e.toString();
    try {
      return await note.run();
    } catch (e2) {
      console.error("failed to send notification: " + e2.toString());
      console.error("original error: " + e.toString());
      return e2;
    }
  }
}

function runPublish(e, p) {
  // Only publish if e.revision.ref is a release tag
  let matchStr = e.revision.ref.match(releaseTagRegex);
  if (matchStr) {
    let matchTokens = Array.from(matchStr);
    let chartName = matchTokens[1];
    let chartVersion = matchTokens[2];
    return build(e, p, chartName, chartVersion).run()
      .then(() => {
        publish(e, p).run();
      });
  }
}

events.on("exec", (e, p) => {
  return test(e, p).run();
})

events.on("check_suite:requested", runSuite)
events.on("check_suite:rerequested", runSuite)
events.on("check_run:rerequested", runCheck)
events.on("issue_comment:created", handleIssueComment);
events.on("issue_comment:edited", handleIssueComment);
events.on("push", runPublish)
