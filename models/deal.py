"""
Deal Model - Handles all database operations for deals
"""
import sqlite3
from datetime import datetime
from pathlib import Path

class Deal:
    """
    Deal model for managing commodity trading deals
    """
    
    def __init__(self, db_path):
        """Initialize with database path"""
        self.db_path = db_path
    
    def get_connection(self):
        """Create and return a database connection"""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row  # Returns rows as dictionaries
        return conn
    
    def get_all(self, status=None, commodity_type=None, limit=100):
        """
        Get all deals with optional filters
        
        Args:
            status: Filter by status (optional)
            commodity_type: Filter by commodity (optional)
            limit: Maximum number of results (default 100)
        
        Returns:
            List of deal dictionaries
        """
        conn = self.get_connection()
        cursor = conn.cursor()
        
        query = "SELECT * FROM deals WHERE 1=1"
        params = []
        
        if status:
            query += " AND status = ?"
            params.append(status)
        
        if commodity_type:
            query += " AND commodity_type = ?"
            params.append(commodity_type)
        
        query += " ORDER BY date_received DESC LIMIT ?"
        params.append(limit)
        
        cursor.execute(query, params)
        deals = [dict(row) for row in cursor.fetchall()]
        
        conn.close()
        return deals
    
    def get_by_id(self, deal_id):
        """
        Get a single deal by ID
        
        Args:
            deal_id: The deal ID
        
        Returns:
            Deal dictionary or None if not found
        """
        conn = self.get_connection()
        cursor = conn.cursor()
        
        cursor.execute("SELECT * FROM deals WHERE id = ?", (deal_id,))
        result = cursor.fetchone()
        
        conn.close()
        
        if result:
            return dict(result)
        return None
    
    def create(self, deal_data):
        """
        Create a new deal
        
        Args:
            deal_data: Dictionary with deal information
        
        Returns:
            ID of newly created deal
        """
        conn = self.get_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
    INSERT INTO deals (
        commodity_type, source_name, source_reliability,
        deal_text, price, price_currency, quantity, quantity_unit,
        origin_country, payment_method, shipping_terms,
        additional_notes, date_received, status,
        price_type, gross_discount, commission, net_discount
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            deal_data.get('commodity_type'),
            deal_data.get('source_name'),
            deal_data.get('source_reliability'),
            deal_data.get('deal_text'),
            deal_data.get('price'),
            deal_data.get('price_currency', 'USD'),
            deal_data.get('quantity'),
            deal_data.get('quantity_unit'),
            deal_data.get('origin_country'),
            deal_data.get('payment_method'),
            deal_data.get('shipping_terms'),
            deal_data.get('additional_notes'),
            deal_data.get('date_received'),
            deal_data.get('status', 'unassigned'),
            deal_data.get('price_type', 'fixed_price'),
            deal_data.get('gross_discount'),
            deal_data.get('commission'),
            deal_data.get('net_discount')
        ))
        
        deal_id = cursor.lastrowid
        conn.commit()
        conn.close()
        
        return deal_id
    
    def update(self, deal_id, deal_data):
        """
        Update an existing deal
        
        Args:
            deal_id: The deal ID to update
            deal_data: Dictionary with updated fields
        
        Returns:
            True if successful, False otherwise
        """
        conn = self.get_connection()
        cursor = conn.cursor()
        
        # Build dynamic UPDATE query based on provided fields
        fields = []
        values = []
        
        for key, value in deal_data.items():
            if key != 'id':  # Don't update ID
                fields.append(f"{key} = ?")
                values.append(value)
        
        if not fields:
            conn.close()
            return False
        
        query = f"UPDATE deals SET {', '.join(fields)} WHERE id = ?"
        values.append(deal_id)
        
        cursor.execute(query, values)
        conn.commit()
        
        success = cursor.rowcount > 0
        conn.close()
        
        return success
    
    def delete(self, deal_id):
        """
        Delete a deal
        
        Args:
            deal_id: The deal ID to delete
        
        Returns:
            True if successful, False otherwise
        """
        conn = self.get_connection()
        cursor = conn.cursor()
        
        cursor.execute("DELETE FROM deals WHERE id = ?", (deal_id,))
        conn.commit()
        
        success = cursor.rowcount > 0
        conn.close()
        
        return success
    
    def get_statistics(self):
        """
        Get dashboard statistics
        
        Returns:
            Dictionary with various stats
        """
        conn = self.get_connection()
        cursor = conn.cursor()
        
        stats = {}
        
        # Total deals
        cursor.execute("SELECT COUNT(*) FROM deals")
        stats['total_deals'] = cursor.fetchone()[0]
        
        # Deals by status
        cursor.execute("""
            SELECT status, COUNT(*) as count
            FROM deals
            GROUP BY status
        """)
        stats['by_status'] = {row['status']: row['count'] for row in cursor.fetchall()}
        
        # Average AI score
        cursor.execute("SELECT AVG(ai_score) FROM deals WHERE ai_score IS NOT NULL")
        result = cursor.fetchone()[0]
        stats['avg_score'] = round(result, 2) if result else 0
        
        # Top commodities
        cursor.execute("""
            SELECT commodity_type, COUNT(*) as count
            FROM deals
            GROUP BY commodity_type
            ORDER BY count DESC
            LIMIT 5
        """)
        stats['top_commodities'] = [dict(row) for row in cursor.fetchall()]
        
        conn.close()
        return stats
