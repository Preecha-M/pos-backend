-- Add salary column to employee table (run this if the column does not exist yet)
-- Example: psql $DATABASE_URL -f prisma/add_employee_salary.sql

ALTER TABLE employee ADD COLUMN IF NOT EXISTS salary DECIMAL(10, 2);
