import os
import sqlite3
import datetime
from werkzeug.security import generate_password_hash
from config import Config

try:
    import pymysql
    import pymysql.cursors
    PYMYSQL_AVAILABLE = True
except ImportError:
    PYMYSQL_AVAILABLE = False


class DatabaseManager:
    def __init__(self):
        self.engine_type = 'sqlite'
        self.init_connection()

    def init_connection(self):
        """Determine whether to use MySQL or SQLite fallback."""
        if Config.DB_TYPE in ['auto', 'mysql'] and PYMYSQL_AVAILABLE:
            try:
                # Test connection to MySQL server
                conn = pymysql.connect(
                    host=Config.MYSQL_HOST,
                    port=Config.MYSQL_PORT,
                    user=Config.MYSQL_USER,
                    password=Config.MYSQL_PASSWORD,
                    charset='utf8mb4',
                    cursorclass=pymysql.cursors.DictCursor,
                    connect_timeout=2
                )
                with conn.cursor() as cur:
                    cur.execute(f"CREATE DATABASE IF NOT EXISTS `{Config.MYSQL_DB}`;")
                conn.select_db(Config.MYSQL_DB)
                conn.close()
                self.engine_type = 'mysql'
                print(f"[DB] Successfully connected to MySQL database: {Config.MYSQL_DB}")
            except Exception as e:
                print(f"[DB] MySQL connection attempt failed ({e}). Falling back to embedded SQLite.")
                self.engine_type = 'sqlite'
        else:
            self.engine_type = 'sqlite'

        self.ensure_tables()
        self.seed_demo_data()

    def get_connection(self):
        """Returns an active connection for the configured engine."""
        if self.engine_type == 'mysql':
            return pymysql.connect(
                host=Config.MYSQL_HOST,
                port=Config.MYSQL_PORT,
                user=Config.MYSQL_USER,
                password=Config.MYSQL_PASSWORD,
                database=Config.MYSQL_DB,
                charset='utf8mb4',
                cursorclass=pymysql.cursors.DictCursor,
                autocommit=False
            )
        else:
            # SQLite connection
            os.makedirs(os.path.dirname(Config.SQLITE_DB_PATH), exist_ok=True)
            conn = sqlite3.connect(Config.SQLITE_DB_PATH)
            conn.row_factory = sqlite3.Row
            # Enable foreign keys
            conn.execute("PRAGMA foreign_keys = ON;")
            return conn

    def format_query(self, query):
        """Format query placeholders: convert %s to ? for SQLite if needed."""
        if self.engine_type == 'sqlite':
            return query.replace('%s', '?')
        return query

    def execute_query(self, query, params=None, fetch_all=False, fetch_one=False, commit=False):
        """Execute a query with parameter substitution and result extraction."""
        conn = self.get_connection()
        query = self.format_query(query)
        params = params or ()
        try:
            if self.engine_type == 'mysql':
                with conn.cursor() as cur:
                    cur.execute(query, params)
                    last_id = cur.lastrowid
                    row_count = cur.rowcount
                    if fetch_all:
                        result = cur.fetchall()
                    elif fetch_one:
                        result = cur.fetchone()
                    else:
                        result = None
                if commit:
                    conn.commit()
                return result, last_id, row_count
            else:
                cur = conn.cursor()
                cur.execute(query, params)
                last_id = cur.lastrowid
                row_count = cur.rowcount
                if fetch_all:
                    rows = cur.fetchall()
                    result = [dict(row) for row in rows]
                elif fetch_one:
                    row = cur.fetchone()
                    result = dict(row) if row else None
                else:
                    result = None
                if commit:
                    conn.commit()
                return result, last_id, row_count
        finally:
            conn.close()

    def query_all(self, query, params=None):
        res, _, _ = self.execute_query(query, params, fetch_all=True)
        return res or []

    def query_one(self, query, params=None):
        res, _, _ = self.execute_query(query, params, fetch_one=True)
        return res

    def execute(self, query, params=None, commit=True):
        _, last_id, row_count = self.execute_query(query, params, commit=commit)
        return last_id, row_count

    def ensure_tables(self):
        """Create tables if they do not exist."""
        if self.engine_type == 'mysql':
            tables_sql = [
                """CREATE TABLE IF NOT EXISTS users (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    full_name VARCHAR(100) NOT NULL,
                    email VARCHAR(120) NOT NULL UNIQUE,
                    phone VARCHAR(20) NOT NULL,
                    password_hash VARCHAR(255) NOT NULL,
                    role ENUM('admin', 'employee', 'customer') NOT NULL DEFAULT 'customer',
                    status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;""",

                """CREATE TABLE IF NOT EXISTS customers (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    user_id INT NOT NULL UNIQUE,
                    date_of_birth DATE,
                    address VARCHAR(255),
                    city VARCHAR(100),
                    state VARCHAR(100),
                    postal_code VARCHAR(20),
                    id_type VARCHAR(50) DEFAULT 'National ID / Aadhaar',
                    id_number VARCHAR(50),
                    occupation VARCHAR(100),
                    annual_income DECIMAL(15, 2) DEFAULT 0.00,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;""",

                """CREATE TABLE IF NOT EXISTS accounts (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    customer_id INT NOT NULL,
                    account_number VARCHAR(20) NOT NULL UNIQUE,
                    account_type ENUM('Savings', 'Current') NOT NULL DEFAULT 'Savings',
                    balance DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
                    status ENUM('active', 'frozen', 'closed') NOT NULL DEFAULT 'active',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;""",

                """CREATE TABLE IF NOT EXISTS transactions (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    transaction_ref VARCHAR(30) NOT NULL UNIQUE,
                    from_account_id INT NULL,
                    to_account_id INT NULL,
                    transaction_type ENUM('DEPOSIT', 'WITHDRAWAL', 'TRANSFER') NOT NULL,
                    amount DECIMAL(15, 2) NOT NULL,
                    balance_after DECIMAL(15, 2) NOT NULL,
                    status ENUM('SUCCESS', 'PENDING', 'FAILED') NOT NULL DEFAULT 'SUCCESS',
                    description VARCHAR(255),
                    created_by INT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (from_account_id) REFERENCES accounts(id) ON DELETE SET NULL,
                    FOREIGN KEY (to_account_id) REFERENCES accounts(id) ON DELETE SET NULL,
                    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;""",

                """CREATE TABLE IF NOT EXISTS audit_logs (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    user_id INT NULL,
                    action VARCHAR(100) NOT NULL,
                    details TEXT,
                    ip_address VARCHAR(45) DEFAULT '127.0.0.1',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;"""
            ]
        else:
            # SQLite tables
            tables_sql = [
                """CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    full_name TEXT NOT NULL,
                    email TEXT NOT NULL UNIQUE,
                    phone TEXT NOT NULL,
                    password_hash TEXT NOT NULL,
                    role TEXT CHECK(role IN ('admin', 'employee', 'customer')) NOT NULL DEFAULT 'customer',
                    status TEXT CHECK(status IN ('active', 'inactive')) NOT NULL DEFAULT 'active',
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                );""",

                """CREATE TABLE IF NOT EXISTS customers (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL UNIQUE,
                    date_of_birth TEXT,
                    address TEXT,
                    city TEXT,
                    state TEXT,
                    postal_code TEXT,
                    id_type TEXT DEFAULT 'National ID / Aadhaar',
                    id_number TEXT,
                    occupation TEXT,
                    annual_income REAL DEFAULT 0.00,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                );""",

                """CREATE TABLE IF NOT EXISTS accounts (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    customer_id INTEGER NOT NULL,
                    account_number TEXT NOT NULL UNIQUE,
                    account_type TEXT CHECK(account_type IN ('Savings', 'Current')) NOT NULL DEFAULT 'Savings',
                    balance REAL NOT NULL DEFAULT 0.00,
                    status TEXT CHECK(status IN ('active', 'frozen', 'closed')) NOT NULL DEFAULT 'active',
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT
                );""",

                """CREATE TABLE IF NOT EXISTS transactions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    transaction_ref TEXT NOT NULL UNIQUE,
                    from_account_id INTEGER NULL,
                    to_account_id INTEGER NULL,
                    transaction_type TEXT CHECK(transaction_type IN ('DEPOSIT', 'WITHDRAWAL', 'TRANSFER')) NOT NULL,
                    amount REAL NOT NULL,
                    balance_after REAL NOT NULL,
                    status TEXT CHECK(status IN ('SUCCESS', 'PENDING', 'FAILED')) NOT NULL DEFAULT 'SUCCESS',
                    description TEXT,
                    created_by INTEGER NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (from_account_id) REFERENCES accounts(id) ON DELETE SET NULL,
                    FOREIGN KEY (to_account_id) REFERENCES accounts(id) ON DELETE SET NULL,
                    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
                );""",

                """CREATE TABLE IF NOT EXISTS audit_logs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NULL,
                    action TEXT NOT NULL,
                    details TEXT,
                    ip_address TEXT DEFAULT '127.0.0.1',
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
                );"""
            ]

        conn = self.get_connection()
        try:
            if self.engine_type == 'mysql':
                with conn.cursor() as cur:
                    for stmt in tables_sql:
                        cur.execute(stmt)
                conn.commit()
            else:
                cur = conn.cursor()
                for stmt in tables_sql:
                    cur.execute(stmt)
                conn.commit()
        finally:
            conn.close()

    def seed_demo_data(self):
        """Populate initial mock users, accounts, and transactions for academic demo."""
        users_count = self.query_one("SELECT COUNT(*) as count FROM users")
        if users_count and users_count['count'] > 0:
            return  # Already seeded

        print("[DB] Seeding realistic sample banking data...")

        # 1. Admin & Employee
        admin_pass = generate_password_hash("Admin@123")
        emp_pass = generate_password_hash("Employee@123")
        cust_pass = generate_password_hash("Customer@123")

        admin_id, _ = self.execute(
            "INSERT INTO users (full_name, email, phone, password_hash, role, status) VALUES (%s, %s, %s, %s, %s, %s)",
            ("System Administrator", "admin@bank.com", "+1-800-555-0101", admin_pass, "admin", "active")
        )

        emp_id, _ = self.execute(
            "INSERT INTO users (full_name, email, phone, password_hash, role, status) VALUES (%s, %s, %s, %s, %s, %s)",
            ("Sarah Jenkins (Branch Officer)", "employee@bank.com", "+1-800-555-0102", emp_pass, "employee", "active")
        )

        # 2. Customers
        customers_data = [
            {
                "name": "John Doe",
                "email": "john.doe@gmail.com",
                "phone": "+1-555-234-5678",
                "dob": "1988-04-12",
                "address": "452 Elm Street, Suite 3B",
                "city": "Springfield",
                "state": "IL",
                "zip": "62701",
                "id_num": "SSN-9842",
                "occupation": "Senior Software Architect",
                "income": 125000.00,
                "acc_num": "1001002345",
                "acc_type": "Savings",
                "balance": 15450.00
            },
            {
                "name": "Jane Smith",
                "email": "jane.smith@gmail.com",
                "phone": "+1-555-345-6789",
                "dob": "1992-09-24",
                "address": "884 Oak Avenue, Apt 12",
                "city": "Chicago",
                "state": "IL",
                "zip": "60611",
                "id_num": "SSN-4512",
                "occupation": "Product Marketing Lead",
                "income": 95000.00,
                "acc_num": "1001005678",
                "acc_type": "Current",
                "balance": 8920.50
            },
            {
                "name": "Robert Chen",
                "email": "robert.chen@gmail.com",
                "phone": "+1-555-456-7890",
                "dob": "1985-11-03",
                "address": "120 Pine Boulevard",
                "city": "Naperville",
                "state": "IL",
                "zip": "60540",
                "id_num": "SSN-7721",
                "occupation": "Chief Financial Analyst",
                "income": 140000.00,
                "acc_num": "1001009012",
                "acc_type": "Savings",
                "balance": 25100.00
            },
            {
                "name": "Emily Watson",
                "email": "emily.watson@gmail.com",
                "phone": "+1-555-567-8901",
                "dob": "1995-02-17",
                "address": "77 Maple Lane",
                "city": "Peoria",
                "state": "IL",
                "zip": "61602",
                "id_num": "SSN-3319",
                "occupation": "Biomedical Researcher",
                "income": 82000.00,
                "acc_num": "1001003411",
                "acc_type": "Savings",
                "balance": 6430.75
            }
        ]

        account_ids = {}

        for c in customers_data:
            u_id, _ = self.execute(
                "INSERT INTO users (full_name, email, phone, password_hash, role, status) VALUES (%s, %s, %s, %s, %s, %s)",
                (c["name"], c["email"], c["phone"], cust_pass, "customer", "active")
            )
            cust_id, _ = self.execute(
                """INSERT INTO customers (user_id, date_of_birth, address, city, state, postal_code, id_number, occupation, annual_income)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)""",
                (u_id, c["dob"], c["address"], c["city"], c["state"], c["zip"], c["id_num"], c["occupation"], c["income"])
            )
            acc_id, _ = self.execute(
                "INSERT INTO accounts (customer_id, account_number, account_type, balance, status) VALUES (%s, %s, %s, %s, %s)",
                (cust_id, c["acc_num"], c["acc_type"], c["balance"], "active")
            )
            account_ids[c["acc_num"]] = acc_id

        # 3. Sample Transactions History
        now = datetime.datetime.now()
        sample_txns = [
            ("TXN-10082341", account_ids["1001002345"], None, "DEPOSIT", 5000.00, 15450.00, "SUCCESS", "Initial Salary Deposit", emp_id, (now - datetime.timedelta(days=12)).strftime('%Y-%m-%d %H:%M:%S')),
            ("TXN-10082342", account_ids["1001005678"], None, "DEPOSIT", 3000.00, 8920.50, "SUCCESS", "Client Invoice Settlement", emp_id, (now - datetime.timedelta(days=10)).strftime('%Y-%m-%d %H:%M:%S')),
            ("TXN-10082343", account_ids["1001002345"], None, "WITHDRAWAL", 800.00, 14650.00, "SUCCESS", "ATM Cash Withdrawal", account_ids["1001002345"], (now - datetime.timedelta(days=8)).strftime('%Y-%m-%d %H:%M:%S')),
            ("TXN-10082344", account_ids["1001009012"], None, "DEPOSIT", 10000.00, 25100.00, "SUCCESS", "Mutual Fund Dividend Payout", emp_id, (now - datetime.timedelta(days=6)).strftime('%Y-%m-%d %H:%M:%S')),
            ("TXN-10082345", account_ids["1001002345"], account_ids["1001005678"], "TRANSFER", 1200.00, 13450.00, "SUCCESS", "Monthly Rent Payment Transfer", account_ids["1001002345"], (now - datetime.timedelta(days=4)).strftime('%Y-%m-%d %H:%M:%S')),
            ("TXN-10082346", account_ids["1001003411"], None, "DEPOSIT", 2500.00, 6430.75, "SUCCESS", "Branch Cash Deposit", emp_id, (now - datetime.timedelta(days=2)).strftime('%Y-%m-%d %H:%M:%S')),
            ("TXN-10082347", account_ids["1001005678"], None, "WITHDRAWAL", 450.00, 8470.50, "SUCCESS", "POS Merchant Terminal Payment", account_ids["1001005678"], (now - datetime.timedelta(days=1)).strftime('%Y-%m-%d %H:%M:%S')),
        ]

        for ref, f_acc, t_acc, t_type, amt, bal, stat, desc, c_by, t_time in sample_txns:
            self.execute(
                """INSERT INTO transactions (transaction_ref, from_account_id, to_account_id, transaction_type, amount, balance_after, status, description, created_by, created_at)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
                (ref, f_acc, t_acc, t_type, amt, bal, stat, desc, c_by, t_time)
            )

        # Audit log entries
        self.execute("INSERT INTO audit_logs (user_id, action, details) VALUES (%s, %s, %s)",
                     (admin_id, "SYSTEM_INIT", "Academic Banking System initialized with seed demonstration records."))
        print("[DB] Sample banking records seeded successfully.")

db = DatabaseManager()
