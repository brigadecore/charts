CHARTS_DIR := ./charts
SERVE_DIR  := ./docs

# --no-print-directory avoids verbose cd logging when invoking targets that utilize sub-makes
MAKE_OPTS  ?= --no-print-directory

ifeq ($(OS),Windows_NT)
	SHELL  ?= cmd.exe
	CHECK  ?= where.exe
else
	SHELL  ?= bash
	CHECK  ?= command -v
endif

HAS_HELM   := $(shell $(CHECK) helm)

.PHONY: default
default:
ifndef HAS_HELM
	$(error You must install helm)
endif

# all-charts loops through all charts and runs the make target(s) provided
define all-charts
	@for chart in $$(ls -1 $(CHARTS_DIR)); do \
		CHART=$$chart make $(MAKE_OPTS) $(1) ; \
	done
endef

.PRECIOUS: build
.PHONY: build
build:
ifndef CHART
	$(call all-charts,build)
else 
	helm package -d $(SERVE_DIR) $(CHARTS_DIR)/$(CHART)
endif

.PHONY: test
test:
ifndef CHART
	$(call all-charts,test)
else 
	helm lint $(CHARTS_DIR)/$(CHART)
endif

.PHONY: index
index:
	helm repo index $(SERVE_DIR)