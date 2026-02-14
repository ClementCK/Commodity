import sqlite3

conn = sqlite3.connect('database/deals.db')
cursor = conn.cursor()

# Get most recent deal
cursor.execute("""
    SELECT id, commodity_type, price_type, gross_discount, commission, net_discount
    FROM deals
    ORDER BY id DESC
    LIMIT 1
""")

deal = cursor.fetchone()

if deal:
    print("✅ Most recent deal:")
    print(f"  ID: {deal[0]}")
    print(f"  Commodity: {deal[1]}")
    print(f"  Price Type: {deal[2]}")
    print(f"  Gross: {deal[3]}%")
    print(f"  Commission: {deal[4]}%")
    print(f"  Net: {deal[5]}%")
    
    if deal[2] is not None:
        print("\n🎉 LME pricing fields are working!")
    else:
        print("\n⚠️ LME pricing fields are empty")
else:
    print("❌ No deals found")

conn.close()