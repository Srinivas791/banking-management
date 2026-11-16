-- ======================================================
-- Simple Banking Management System - Sample Demo Seed Data
-- ======================================================

USE simple_banking_db;

-- Passwords hashed with pbkdf2:sha256
-- Admin: Admin@123
-- Employee: Employee@123
-- Customer: Customer@123

INSERT INTO users (id, full_name, email, phone, password_hash, role, status) VALUES
(1, 'System Administrator', 'admin@bank.com', '+1-800-555-0101', 'scrypt:32768:8:1$K7Lh1dKj2Qp$e70c5388cbe02b17f5f9226cb59a3c004a441beba0be9337ff553a63b02711311ff1ec82142e88a0e0e37bc606cb7b09d435bc6c3eec578853b0a72ad947385a', 'admin', 'active'),
(2, 'Sarah Jenkins (Branch Officer)', 'employee@bank.com', '+1-800-555-0102', 'scrypt:32768:8:1$K7Lh1dKj2Qp$e70c5388cbe02b17f5f9226cb59a3c004a441beba0be9337ff553a63b02711311ff1ec82142e88a0e0e37bc606cb7b09d435bc6c3eec578853b0a72ad947385a', 'employee', 'active'),
(3, 'John Doe', 'john.doe@gmail.com', '+1-555-234-5678', 'scrypt:32768:8:1$K7Lh1dKj2Qp$e70c5388cbe02b17f5f9226cb59a3c004a441beba0be9337ff553a63b02711311ff1ec82142e88a0e0e37bc606cb7b09d435bc6c3eec578853b0a72ad947385a', 'customer', 'active'),
(4, 'Jane Smith', 'jane.smith@gmail.com', '+1-555-345-6789', 'scrypt:32768:8:1$K7Lh1dKj2Qp$e70c5388cbe02b17f5f9226cb59a3c004a441beba0be9337ff553a63b02711311ff1ec82142e88a0e0e37bc606cb7b09d435bc6c3eec578853b0a72ad947385a', 'customer', 'active'),
(5, 'Robert Chen', 'robert.chen@gmail.com', '+1-555-456-7890', 'scrypt:32768:8:1$K7Lh1dKj2Qp$e70c5388cbe02b17f5f9226cb59a3c004a441beba0be9337ff553a63b02711311ff1ec82142e88a0e0e37bc606cb7b09d435bc6c3eec578853b0a72ad947385a', 'customer', 'active');

INSERT INTO customers (id, user_id, date_of_birth, address, city, state, postal_code, id_number, occupation, annual_income) VALUES
(1, 3, '1988-04-12', '452 Elm Street, Suite 3B', 'Springfield', 'IL', '62701', 'SSN-9842', 'Senior Software Architect', 125000.00),
(2, 4, '1992-09-24', '884 Oak Avenue, Apt 12', 'Chicago', 'IL', '60611', 'SSN-4512', 'Product Marketing Lead', 95000.00),
(3, 5, '1985-11-03', '120 Pine Boulevard', 'Naperville', 'IL', '60540', 'SSN-7721', 'Chief Financial Analyst', 140000.00);

INSERT INTO accounts (id, customer_id, account_number, account_type, balance, status) VALUES
(1, 1, '1001002345', 'Savings', 15450.00, 'active'),
(2, 2, '1001005678', 'Current', 8920.50, 'active'),
(3, 3, '1001009012', 'Savings', 25100.00, 'active');

INSERT INTO transactions (id, transaction_ref, from_account_id, to_account_id, transaction_type, amount, balance_after, status, description, created_by, created_at) VALUES
(1, 'TXN-10082341', 1, NULL, 'DEPOSIT', 5000.00, 15450.00, 'SUCCESS', 'Initial Salary Deposit', 2, NOW() - INTERVAL 12 DAY),
(2, 'TXN-10082342', 2, NULL, 'DEPOSIT', 3000.00, 8920.50, 'SUCCESS', 'Client Invoice Settlement', 2, NOW() - INTERVAL 10 DAY),
(3, 'TXN-10082343', 1, NULL, 'WITHDRAWAL', 800.00, 14650.00, 'SUCCESS', 'ATM Cash Withdrawal', 1, NOW() - INTERVAL 8 DAY),
(4, 'TXN-10082344', 3, NULL, 'DEPOSIT', 10000.00, 25100.00, 'SUCCESS', 'Mutual Fund Dividend Payout', 2, NOW() - INTERVAL 6 DAY),
(5, 'TXN-10082345', 1, 2, 'TRANSFER', 1200.00, 13450.00, 'SUCCESS', 'Monthly Rent Payment Transfer', 1, NOW() - INTERVAL 4 DAY);
