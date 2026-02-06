# pg_track Makefile
# Uses PostgreSQL Extension Building Infrastructure (PGXS)

EXTENSION = pg_track
MODULE_big = pg_track
OBJS = src/pg_track.o

DATA = sql/pg_track--1.0.sql
DOCS = README.md

# Extra cleanup
EXTRA_CLEAN = src/*.o

# PostgreSQL build infrastructure
PG_CONFIG ?= pg_config
PGXS := $(shell $(PG_CONFIG) --pgxs)
include $(PGXS)

# Custom targets
.PHONY: rpm deb

rpm:
	@echo "Building RPM package..."
	rpmbuild -ba rpm/pg_track.spec

deb:
	@echo "Building Debian package..."
	dpkg-buildpackage -us -uc -b
