#include "postgres.h"
#include "fmgr.h"
#include "utils/builtins.h"

PG_MODULE_MAGIC;

/*
 * C functionality can be added here in the future.
 * Currently serves as a placeholder to ensure C extension compatibility.
 */

PG_FUNCTION_INFO_V1(pg_track_version);

Datum
pg_track_version(PG_FUNCTION_ARGS)
{
    PG_RETURN_TEXT_P(cstring_to_text("1.0.0"));
}
