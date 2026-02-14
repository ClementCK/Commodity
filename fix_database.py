"""
Fix malformed AI reasoning data in the database
"""
import sqlite3
import json

db_path = 'data/deals.db'

def fix_ai_reasoning():
    """Fix ai_reasoning fields that were stored as string representations"""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # Get all deals with AI scores
    cursor.execute("SELECT id, ai_reasoning, ai_analysis FROM deals WHERE ai_score IS NOT NULL")
    deals = cursor.fetchall()

    print(f"Found {len(deals)} deals with AI scores")

    for deal_id, ai_reasoning, ai_analysis in deals:
        try:
            # Try to fix ai_reasoning
            if ai_reasoning:
                # If it starts with "['" it's a string representation of a list
                if ai_reasoning.startswith("['") or ai_reasoning.startswith('["'):
                    # Convert to empty list for now (data was corrupted)
                    cursor.execute("UPDATE deals SET ai_reasoning = ? WHERE id = ?",
                                 (json.dumps([]), deal_id))
                    print(f"Fixed deal {deal_id} - cleared corrupted reasoning")
                else:
                    # Try to parse it
                    try:
                        json.loads(ai_reasoning)
                        print(f"Deal {deal_id} - reasoning is valid JSON")
                    except:
                        # Clear it
                        cursor.execute("UPDATE deals SET ai_reasoning = ? WHERE id = ?",
                                     (json.dumps([]), deal_id))
                        print(f"Fixed deal {deal_id} - cleared invalid reasoning")

            # Check ai_analysis
            if ai_analysis:
                try:
                    json.loads(ai_analysis)
                    print(f"Deal {deal_id} - analysis is valid JSON")
                except:
                    print(f"WARNING: Deal {deal_id} - analysis is invalid JSON (keeping as-is)")

        except Exception as e:
            print(f"Error processing deal {deal_id}: {e}")

    conn.commit()
    conn.close()
    print("\nDatabase cleanup complete!")

if __name__ == '__main__':
    fix_ai_reasoning()
