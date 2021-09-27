{{/* vim: set filetype=mustache */}}
{{/*
Expand the name of the chart.
*/}}
{{- define "brigade.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{/*
Create a default fully qualified app name.
We truncate at 63 chars because some Kubernetes name fields are limited to this (by the DNS naming spec).
*/}}
{{- define "brigade.fullname" -}}
{{- $name := default .Chart.Name .Values.nameOverride -}}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "brigade.ctrl.fullname" -}}
{{ include "brigade.fullname" . | printf "%s-ctrl" }}
{{- end -}}
{{- define "brigade.api.fullname" -}}
{{ include "brigade.fullname" . | printf "%s-api" }}
{{- end -}}
{{- define "brigade.worker.fullname" -}}
{{ include "brigade.fullname" . | printf "%s-wrk" }}
{{- end -}}
{{- define "brigade.cr.fullname" -}}
{{ include "brigade.fullname" . | printf "%s-cr-gw" }}
{{- end -}}
{{- define "brigade.genericGateway.fullname" -}}
{{ include "brigade.fullname" . | printf "%s-generic-gateway" }}
{{- end -}}
{{- define "brigade.vacuum.fullname" -}}
{{ include "brigade.fullname" . | printf "%s-vacuum" }}
{{- end -}}

{{- define "brigade.rbac.version" }}rbac.authorization.k8s.io/v1{{ end -}}

{{/*
Return the appropriate apiVersion for a deployment
*/}}
{{- define "deployment.apiVersion" -}}
{{- if semverCompare "<1.14-0" .Capabilities.KubeVersion.GitVersion -}}
{{- print "extensions/v1beta1" -}}
{{- else -}}
{{- print "apps/v1" -}}
{{- end -}}
{{- end -}}

{{/*
Return the appropriate apiVersion for a networking object.
*/}}
{{- define "networking.apiVersion" -}}
{{- if semverCompare "<1.14-0" .Capabilities.KubeVersion.GitVersion -}}
{{- print "extensions/v1beta1" -}}
{{- else if semverCompare "<1.19-0" .Capabilities.KubeVersion.GitVersion -}}
{{- print "networking.k8s.io/v1beta1" -}}
{{- else -}}
{{- print "networking.k8s.io/v1" -}}
{{- end -}}
{{- end -}}

{{- define "networking.apiVersion.isStable" -}}
  {{- eq (include "networking.apiVersion" .) "networking.k8s.io/v1" -}}
{{- end -}}

{{- define "networking.apiVersion.supportIngressClassName" -}}
  {{- semverCompare ">=1.18-0" .Capabilities.KubeVersion.GitVersion -}}
{{- end -}}
