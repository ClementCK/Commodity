"""
Test script to verify database operations work
"""

import sqlite3
from datetime import date

conn = sqlite3.connect('database/deals.db')
cursor = conn.cursor()

print("=" * 60)
print("DATABASE OPERATION TESTS")
print("=" * 60)

# TEST 1: View sources
print("\n📋 TEST 1: View all sources")
print("-" * 60)
cursor.execute("SELECT * FROM sources")
sources = cursor.fetchall()
print(f"Found {len(sources)} sources:")
for source in sources:
    print(f"  ID: {source[0]} | Name: {source[1]} | Rating: {source[2]}/10")

# TEST 2: Add a deal
print("\n➕ TEST 2: Add a new deal")
print("-" * 60)
try:
    cursor.execute("""
        INSERT INTO deals (
            commodity_type, source_name, source_reliability,
            deal_text, price, price_currency, quantity, quantity_unit,
            origin_country, payment_method, shipping_terms,
            date_received, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        "Gold", "John Mensah", 7,
        "Ghana Gold Dore Bars, 500kg, LME -9%, SBLC payment, CIF",
        -9.0, "USD", 500.0, "kg", "Ghana", "SBLC", "CIF",
        date.today(), "unassigned"
    ))
    conn.commit()
    print(f"✅ Deal added! ID: {cursor.lastrowid}")
except sqlite3.Error as e:
    print(f"❌ Error: {e}")

# TEST 3: View deals
print("\n📋 TEST 3: View all deals")
print("-" * 60)
cursor.execute("SELECT id, commodity_type, source_name, status FROM deals")
deals = cursor.fetchall()
print(f"Found {len(deals)} deal(s):")
for deal in deals:
    print(f"  ID: {deal[0]} | {deal[1]} | Source: {deal[2]} | Status: {deal[3]}")

conn.close()
print("\n" + "=" * 60)
print("✅ ALL TESTS COMPLETE!")
print("=" * 60)