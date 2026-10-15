-- =====================================================================
-- Fusion SQL - BI Publisher data model SQL (data set "DS_SQL")
--
-- Data source:   ApplicationDB_FSCM
-- Type of SQL:   Non-standard SQL      <-- required: the query starts with WITH FUNCTION
-- Parameters:    p_sql       String    the SELECT to run (sent by the VB app)
--                p_max_rows  String    optional row limit; empty or 0 = no limit
--
-- What it does: opens a cursor on p_sql and turns the rows into XML with DBMS_XMLGEN.
-- NULL_ATTR keeps NULL columns in every row (as <COL xsi:nil="true"/>), so the app can
-- show all columns in the order of the query. The result comes back in DATA_DS/G_1/RESULT.
--
-- It can only read: a cursor can't run INSERT, UPDATE, DELETE or DDL. It runs with the
-- data source's database access, not the Fusion user's data roles, so give the report
-- to the people who may see that data and no one else.
-- =====================================================================
WITH
  FUNCTION fq_run_sql (p_sql IN VARCHAR2, p_max_rows IN VARCHAR2) RETURN CLOB IS
    l_cursor SYS_REFCURSOR;
    l_ctx    DBMS_XMLGEN.ctxHandle;
    l_xml    CLOB;
    l_max    NUMBER := TO_NUMBER(TRIM(p_max_rows));
  BEGIN
    OPEN l_cursor FOR p_sql;
    l_ctx := DBMS_XMLGEN.newContext(l_cursor);
    DBMS_XMLGEN.setNullHandling(l_ctx, DBMS_XMLGEN.NULL_ATTR);
    IF NVL(l_max, 0) > 0 THEN
      DBMS_XMLGEN.setMaxRows(l_ctx, l_max);
    END IF;
    l_xml := DBMS_XMLGEN.getXML(l_ctx);
    DBMS_XMLGEN.closeContext(l_ctx);
    IF l_cursor%ISOPEN THEN
      CLOSE l_cursor;
    END IF;
    RETURN l_xml;
  END;
SELECT fq_run_sql(:p_sql, :p_max_rows) AS result
  FROM dual
