-- Rollback: черга нерозпізнаних інгредієнтів/продуктів (20260613_1000)

DROP FUNCTION IF EXISTS set_unmatched_status(uuid, text);
DROP FUNCTION IF EXISTS get_unmatched_terms(text, int);
DROP FUNCTION IF EXISTS log_unmatched_term(text, text, text);
DROP TABLE IF EXISTS unmatched_terms;
