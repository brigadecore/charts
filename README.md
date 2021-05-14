
# Brigade Charts

Helm charts for the [Brigade](https://github.com/brigadecore/brigade) project.

**Note**: the charts in this repo are for Brigade v1.  For Brigade v2 charts,
see the [charts][v2 charts] directory in the [v2 branch].

# Contributing Guidelines

This Brigade project accepts contributions via GitHub pull requests. This
section outlines the process to help get your contribution accepted.

## Versioning

Do _not_ include changes to the `version` field of any chart's `Chart.yaml` file
in your PRs. This field is set automatically through this project's
[release process](#release-process).

## Signed commits

A DCO sign-off is required for contributions to repos in the brigadecore org.  See the documentation in
[Brigade's Contributing guide](https://github.com/brigadecore/brigade/blob/master/CONTRIBUTING.md#signed-commits)
for how this is done.

# Release Process

Experience has demonstrated that automatically publishing updated charts upon
every merge to the master branch while simmultaneously respecting the
immutability of existing (i.e. previously published), semantically versioned
charts can be challenging. In such a scheme, every PR effectively represents a
release, which then requires the `version` field to be appropriately incremented
in the `Chart.yaml` file of any chart modified by a given PR. This requirement
promotes race conditions dependent on the order in which PRs are merged and is
onerous both for contributors to comply with and for maintainers to enforce. A
particularly undesirable consequence of mis-managing this requirement (i.e.
forgetting to increment the version number) is that an existing (i.e. previously
published), semantically versioned chart may be _overwritten_ violating any
reasonable expectation of its immutability. These challenges aside, such a
scheme is also inflexible, as it prevents maintainers from arbitrarily grouping
multiple discrete changes to a single chart into a single release.

For the reasons stated above, the maintainers have elected _not_ to continuously
publish the charts in this repository. Instead, as is common for many projects
(though less common for chart projects), releases are facilitated through the
application of git tags to a specific commit.

Since this repository contains the source code for multiple charts which are
versioned _independently of one another_, the tags that are applied to effect
releases must include not only the semantic version we wish to assign to the
release, but must _also_ contain the _name_ of the chart which is to be released
(published). Tags therefore take the form `<chart name>-v<semantic version>`.

To effect the release of Kashti `1.0.0` from the head of the `master` branch,
for example:

```
$ git checkout master
$ git pull upstream master
$ git tag kashti-v1.0.0
$ git push upstream --tags
```

Note that only a project maintainer is able to perform the steps above.

Note also that the semantic version extracted from the tag will be automatically
inserted into the `version` field of the indicated chart's `Chart.yaml` file
when the chart is packaged for release. Effectively, this absolves contributors
and maintainers from ever manually modifying that field, however, it does
require that maintainers conducting a release take great care to be aware of
what the latest release of a given chart was and whether the changes staged for
release necessitate incrementing the major, minor, or patch components of the
previous version to arrive at the new version.

Maintainers might utilize a workflow such as that shown below to facilitate
a release. Here, we imagine a scenario where the most recent release of the
Kashti chart was semantically versioned `1.1.0` and the maintainer is aware
that the release they are conducting contains new features, but no breaking
changes:

```
$ helm repo up
Hang tight while we grab the latest from your chart repositories...
...Successfully got an update from the "brigade" chart repository
...Successfully got an update from the "stable" chart repository
Update Complete. ⎈ Happy Helming!⎈ 
$ helm search kashti
NAME          	CHART VERSION	APP VERSION	DESCRIPTION                
brigade/kashti	1.1.0        	           	A Helm chart for Kashti
$ git checkout master
$ git pull upstream master
$ git tag kashti-v1.2.0
$ git push upstream --tags
```

[v2 charts]: https://github.com/brigadecore/brigade/tree/v2/charts
[v2 branch]: https://github.com/brigadecore/brigade/tree/v2