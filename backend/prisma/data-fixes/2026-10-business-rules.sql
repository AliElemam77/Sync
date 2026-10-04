-- One-off data fixes that accompany the Phase 2 business-rule changes.
-- Run ONCE, against each environment, when deploying that code. Take a backup first.

BEGIN;

-- 1) Employees already ENDED or INACTIVE must not be able to log in
--    (the app now enforces this on every status change, but existing rows predate the rule).
UPDATE users
SET is_active = false
WHERE id IN (
  SELECT user_id FROM employee_profiles WHERE status IN ('ENDED', 'INACTIVE')
);

-- 2) monthly_permission_hours used to be decremented on every approval and never reset.
--    It is now the monthly ALLOWANCE (what is left is computed per month), so put the
--    allowance back. 4 hours is the default for every employee created by the app;
--    re-enter any custom allowance afterwards from the employee edit page.
UPDATE employee_profiles
SET monthly_permission_hours = 4;

COMMIT;
