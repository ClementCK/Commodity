"""
Database Initialization Script
This script creates the SQLite database and sets up all tables
"""

import sqlite3
import os
from pathlib import Path

# Get the directory where this script is located
SCRIPT_DIR = Path(__file__).parent
DATABASE_PATH = SCRIPT_DIR / "deals.db"
SCHEMA_PATH = SCRIPT_DIR / "schema.sql"


def init_database():
    """
    Initialize the database by:
    1. Creating the database file if it doesn't exist
    2. Running the schema.sql file to create tables
    3. Verifying the tables were created successfully
    """
    
    print("=" * 50)
    print("DATABASE INITIALIZATION")
    print("=" * 50)
    
    # Check if database already exists
    if DATABASE_PATH.exists():
        print(f"⚠️  Database already exists at: {DATABASE_PATH}")
        response = input("Do you want to recreate it? (y/n): ")
        if response.lower() != 'y':
            print("❌ Initialization cancelled.")
            return
        else:
            os.remove(DATABASE_PATH)
            print("✅ Old database deleted.")
    
    # Create database connection
    print(f"\n📦 Creating database at: {DATABASE_PATH}")
    conn = sqlite3.connect(DATABASE_PATH)
    cursor = conn.cursor()
    
    # Read schema file
    print(f"📄 Reading schema from: {SCHEMA_PATH}")
    with open(SCHEMA_PATH, 'r', encoding='utf-8') as f:
        schema_sql = f.read()
    
    # Execute schema (create tables)
    print("🔨 Creating tables...")
    try:
        cursor.executescript(schema_sql)
        conn.commit()
        print("✅ Tables created successfully!")
    except sqlite3.Error as e:
        print(f"❌ Error creating tables: {e}")
        conn.close()
        return
    
    # Verify tables were created
    print("\n🔍 Verifying tables...")
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;")
    tables = cursor.fetchall()
    
    if tables:
        print(f"✅ Found {len(tables)} tables:")
        for table in tables:
            print(f"   - {table[0]}")
            
            # Count rows in each table
            cursor.execute(f"SELECT COUNT(*) FROM {table[0]}")
            count = cursor.fetchone()[0]
            print(f"     ({count} rows)")
    else:
        print("❌ No tables found! Something went wrong.")
    
    # Close connection
    conn.close()
    
    print("\n" + "=" * 50)
    print("✅ DATABASE INITIALIZATION COMPLETE")
    print("=" * 50)
    print(f"\nYour database is ready at: {DATABASE_PATH}")
    print("\nNext steps:")
    print("1. Run test_database.py to test operations")
    print("2. Start building your Flask app!")


if __name__ == "__main__":
    init_database()