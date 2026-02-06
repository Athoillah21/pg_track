# PostgreSQL version - change this to build for different versions
# Supported: 15, 16, 17, 18
%{!?pg_version: %define pg_version 15}

Name:           pgtrack_pg%{pg_version}
Version:        1.0.0
Release:        1%{?dist}
Summary:        PostgreSQL %{pg_version} extension for version control and change tracking
License:        PostgreSQL
URL:            https://github.com/yourusername/pgtrack
Source0:        pgtrack-%{version}.tar.gz
BuildArch:      noarch

# Build requirements for C extension
BuildRequires:  postgresql%{pg_version}-devel
BuildRequires:  gcc
BuildRequires:  make

%description
pg_track is a PostgreSQL extension that provides automatic version control
for database tables. It tracks all INSERT, UPDATE, and DELETE operations
and allows reverting data to any previous state.

%prep
%setup -q -n pg_track-%{version}

%build
# Build C extension
make PG_CONFIG=%{_bindir}/pg_config

%install
# Install C shared library
install -D -p -m 755 pg_track.so %{buildroot}%{_libdir}/pgsql/pg_track.so
# Install control file
install -D -p -m 644 pg_track.control %{buildroot}%{_datadir}/pgsql/extension/pg_track.control
# Install SQL file
install -D -p -m 644 sql/pg_track--1.0.sql %{buildroot}%{_datadir}/pgsql/extension/pg_track--1.0.sql

%files
%doc README.md
%{_libdir}/pgsql/pg_track.so
%{_datadir}/pgsql/extension/pg_track.control
%{_datadir}/pgsql/extension/pg_track--1.0.sql

%changelog
* Wed Feb 05 2025 pgtrack contributors <dev@example.com> - 1.0.0-1
- Initial release (Pure SQL)
- Support for PostgreSQL 15, 16, 17, 18
- Schema-based automatic tracking
- Revert functions for all scenarios
