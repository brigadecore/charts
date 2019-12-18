CHARTS_DIR := ./charts
SERVE_DIR  := ./dist

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
		CHART=$$chart make $(MAKE_OPTS) $(1) || exit $$? ; \
	done
endef

.PRECIOUS: build
.PHONY: build
build: clean
ifndef CHART
	$(error CHART is undefined)
endif
ifndef VERSION
	$(error VERSION is undefined)
endif
	@helm dep up $(CHARTS_DIR)/$(CHART)
	@mkdir -p $(SERVE_DIR)
	@helm package --version $(VERSION) -d $(SERVE_DIR) $(CHARTS_DIR)/$(CHART)

.PHONY: test
test:
ifndef CHART
	$(call all-charts,test)
else 
	@helm lint $(CHARTS_DIR)/$(CHART)
endif

.PHONY: index
index:
	@mkdir -p $(SERVE_DIR)
	@helm repo index --merge $(SERVE_DIR)/index.yaml $(SERVE_DIR)

# remove untracked sub-chart artifacts before rebuilding
.PHONY: clean
clean:
ifndef CHART
	$(call all-charts,clean)
else
	@rm -rf $(CHARTS_DIR)/$(CHART)/charts
endif