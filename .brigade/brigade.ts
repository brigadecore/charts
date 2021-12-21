import { Event, events, Job, SerialGroup } from "@brigadecore/brigadier"

const helmImg = "brigadecore/helm-tools:v0.4.0"
const jsImg = "node:16.11.0-bullseye"

const workspacePath = "/workspace"

// A map of all jobs. When a check_run:rerequested event wants to re-run a
// single job, this allows us to easily find that job by name.
const jobs: { [key: string]: (event: Event) => Job } = {}

const testJobName = "test"
const testJob = (event: Event) => {
	const job = new Job(testJobName, helmImg, event)
	job.primaryContainer.sourceMountPath = "/src"
	job.primaryContainer.workingDirectory = "/src"
	job.primaryContainer.command = ["make"]
	job.primaryContainer.arguments = ["test"]
	return job
}
jobs[testJobName] = testJob

const buildJobName = "build"
const buildJob = (event: Event, chartName?:string, chartVersion?: string) => {
	const job = new Job(buildJobName, helmImg, event)
	job.primaryContainer.sourceMountPath = "/src"
	job.primaryContainer.workingDirectory = "/src"
	job.primaryContainer.workspaceMountPath = workspacePath
	job.primaryContainer.environment = {
		"CHART": chartName,
		"VERSION": chartVersion
	}
	job.primaryContainer.command = ["sh"]
	job.primaryContainer.arguments = [
		"-c",
		"helm repo add brigade https://brigadecore.github.io/charts && " + 
		"make build && " +
		"curl -o dist/index.yaml https://raw.githubusercontent.com/brigadecore/charts/gh-pages/index.yaml && " +
		"make index && " +
		`cp -a dist/ ${workspacePath}`
	]
	return job
}

const publishJobName = "publish"
const publishJob = (event: Event) => {
	const job = new Job(publishJobName, jsImg, event)
	job.primaryContainer.sourceMountPath = workspacePath
	job.primaryContainer.workingDirectory = workspacePath
	job.primaryContainer.workspaceMountPath = workspacePath
	job.primaryContainer.environment = {
		"GITHUB_TOKEN": event.project.secrets.ghToken
	}
	job.primaryContainer.command = ["sh"]
	job.primaryContainer.arguments = [
		"-c",
		"npm install -g gh-pages@3.0.0 && " +
		`gh-pages --add -d dist -r https://brigadeci:$GITHUB_TOKEN@github.com/brigadecore/charts.git -u "Brigade CI <brigade@ci>" -m "Add chart artifacts and update index.yaml"`
	]
	return job
}

async function runSuite(event: Event): Promise<void> {
	await testJob(event).run()
}

// Either of these events should initiate execution of the entire test suite.
events.on("brigade.sh/github", "check_suite:requested", runSuite)
events.on("brigade.sh/github", "check_suite:rerequested", runSuite)

// This event indicates a specific job is to be re-run.
events.on("brigade.sh/github", "check_run:rerequested", async event => {
	// Check run names are of the form <project name>:<job name>, so we strip
	// event.project.id.length + 1 characters off the start of the check run name
	// to find the job name.
	const jobName = JSON.parse(event.payload).check_run.name.slice(event.project.id.length + 1)
	const job = jobs[jobName]
	if (job) {
		await job(event).run()
		return
	}
	throw new Error(`No job found with name: ${jobName}`)
})

events.on("brigade.sh/github", "release:published", async event => {
	const releaseTagRegex = /^refs\/tags\/([A-Za-z0-9\-]+)\-v([0-9]+(?:\.[0-9]+)*(?:\-.+)?)$/
  let matchStr = JSON.parse(event.payload).release.tag_name.match(releaseTagRegex)
  if (matchStr) {
    let matchTokens = Array.from(matchStr)
    const chartName = matchTokens[1] as string
    const chartVersion = matchTokens[2] as string
		await new SerialGroup(
			buildJob(event, chartName, chartVersion),
			publishJob(event)
		).run()
  }
})

events.process()
