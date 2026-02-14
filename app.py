"""
Main Flask Application
Commodity Deal Tracker
"""
from flask import Flask, render_template, request, jsonify
from flask_cors import CORS
from config import Config
from models.deal import Deal
from datetime import datetime

# Initialize Flask app
app = Flask(__name__)
app.config.from_object(Config)
CORS(app)

# Initialize Deal model
deal_model = Deal(app.config['DATABASE_PATH'])

# ============================================
# Web Routes (HTML pages)
# ============================================

@app.route('/')
def index():
    """Home page - Dashboard"""
    return render_template('dashboard.html')
@app.route('/kanban')
def kanban():
    """Kanban board view"""
    return render_template('kanban.html')

@app.route('/deals/new')
def new_deal_form():
    """New deal form page"""
    return render_template('deal_form.html')

@app.route('/deals/<int:deal_id>')
def deal_detail(deal_id):
    """Deal detail page"""
    return render_template('deal_detail.html', deal_id=deal_id)

@app.route('/deals/<int:deal_id>/analysis')
def deal_analysis(deal_id):
    """AI Analysis page"""
    return render_template('deal_analysis.html', deal_id=deal_id)

@app.route('/deals/<int:deal_id>/score')
def ai_score_page(deal_id):
    """AI Scoring page - scores deal and shows results"""
    return render_template('ai_score.html', deal_id=deal_id)

# ============================================
# API Routes (JSON responses)
# ============================================

@app.route('/api/deals', methods=['GET'])
def get_deals():
    """
    Get all deals with optional filters
    
    Query params:
        status: Filter by status
        commodity_type: Filter by commodity
        limit: Max results (default 100)
    """
    status = request.args.get('status')
    commodity_type = request.args.get('commodity_type')
    limit = int(request.args.get('limit', 100))
    
    deals = deal_model.get_all(status=status, commodity_type=commodity_type, limit=limit)
    
    return jsonify({
        'success': True,
        'count': len(deals),
        'deals': deals
    })

@app.route('/api/deals/<int:deal_id>', methods=['GET'])
def get_deal(deal_id):
    """Get a single deal by ID"""
    deal = deal_model.get_by_id(deal_id)
    
    if deal:
        return jsonify({
            'success': True,
            'deal': deal
        })
    else:
        return jsonify({
            'success': False,
            'error': 'Deal not found'
        }), 404

@app.route('/api/deals', methods=['POST'])
def create_deal():
    """
    Create a new deal
    
    Request body: JSON with deal data
    """
    data = request.get_json()
    
    # Handle LME pricing fields
    if data.get('gross_discount'):
        data['gross_discount'] = float(data['gross_discount'])
    if data.get('commission'):
        data['commission'] = float(data['commission'])
    if data.get('net_discount'):
        data['net_discount'] = float(data['net_discount'])
    
    # Validate required fields
    # Validate required fields
    required = ['commodity_type', 'source_name', 'date_received']
    for field in required:
        if field not in data:
            return jsonify({
                'success': False,
                'error': f'Missing required field: {field}'
            }), 400
    
    # Create the deal
    deal_id = deal_model.create(data)
    
    return jsonify({
        'success': True,
        'deal_id': deal_id,
        'message': 'Deal created successfully'
    }), 201

@app.route('/api/deals/<int:deal_id>', methods=['PUT'])
def update_deal(deal_id):
    """Update an existing deal"""
    data = request.get_json()
    
    success = deal_model.update(deal_id, data)
    
    if success:
        return jsonify({
            'success': True,
            'message': 'Deal updated successfully'
        })
    else:
        return jsonify({
            'success': False,
            'error': 'Deal not found or update failed'
        }), 404

@app.route('/api/deals/<int:deal_id>', methods=['DELETE'])
def delete_deal(deal_id):
    """Delete a deal"""
    success = deal_model.delete(deal_id)
    
    if success:
        return jsonify({
            'success': True,
            'message': 'Deal deleted successfully'
        })
    else:
        return jsonify({
            'success': False,
            'error': 'Deal not found'
        }), 404

@app.route('/api/statistics', methods=['GET'])
def get_statistics():
    """Get dashboard statistics"""
    stats = deal_model.get_statistics()
    
    return jsonify({
        'success': True,
        'statistics': stats
    })
@app.route('/api/deals/<int:deal_id>/score', methods=['POST'])
def score_deal(deal_id):
    """
    Score a deal using AI
    """
    from services.ai_scorer import AIScorer

    # Get the deal
    deal = deal_model.get_by_id(deal_id)
    if not deal:
        return jsonify({
            'success': False,
            'error': 'Deal not found'
        }), 404

    # Check if API key is configured
    if not app.config.get('ANTHROPIC_API_KEY'):
        return jsonify({
            'success': False,
            'error': 'API key not configured'
        }), 400

    try:
        # Initialize AI scorer
        scorer = AIScorer(os.environ.get('ANTHROPIC_API_KEY'))

        # Score the deal
        result = scorer.score_deal(deal)

        if result['success']:
            # Update deal with AI score and reasoning
            import json

            deal_model.update(deal_id, {
    'ai_score': result['score'],
    'ai_reasoning': json.dumps(result['reasoning']),
    'ai_analysis': json.dumps({
        'executive_summary': result.get('executive_summary'),
        'market_analysis': result.get('market_analysis'),
        'origin_analysis': result.get('origin_analysis'),
        'buyer_profile': result.get('buyer_profile'),
        'price_analysis': result.get('price_analysis'),
        'payment_logistics': result.get('payment_logistics'),
        'red_flags': result.get('red_flags', []),
        'unusual_patterns': result.get('unusual_patterns', []),
        'strengths': result.get('strengths', []),
        'next_steps': result.get('next_steps', []),
        'recommendation': result.get('recommendation', ''),
        'risk_level': result.get('risk_level', 'medium')
    })
})

            return jsonify({
       'success': True,
    'score': result['score'],
    'reasoning': result['reasoning'],
    'recommendation': result.get('recommendation', ''),
    'risk_level': result.get('risk_level', 'medium'),
    'executive_summary': result.get('executive_summary'),
    'market_analysis': result.get('market_analysis'),
    'origin_analysis': result.get('origin_analysis'),
    'buyer_profile': result.get('buyer_profile'),
    'price_analysis': result.get('price_analysis'),
    'payment_logistics': result.get('payment_logistics'),
    'red_flags': result.get('red_flags', []),
    'unusual_patterns': result.get('unusual_patterns', []),
    'strengths': result.get('strengths', []),
    'next_steps': result.get('next_steps', [])
            })
        else:
            return jsonify({
                'success': False,
                'error': result.get('error', 'Unknown error')
            }), 500

    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/deals/<int:deal_id>/download-analysis', methods=['GET'])
def download_analysis(deal_id):
    """
    Download AI analysis as a Word document
    """
    try:
        from services.word_generator import WordGenerator
        from flask import send_file
        import io

        # Get the deal
        deal = deal_model.get_by_id(deal_id)
        if not deal:
            return jsonify({
                'success': False,
                'error': 'Deal not found'
            }), 404

        # Check if AI analysis exists
        if not deal.get('ai_score'):
            return jsonify({
                'success': False,
                'error': 'This deal has not been scored yet. Please score the deal first.'
            }), 400

        # Generate Word document
        generator = WordGenerator()
        doc = generator.generate_analysis_report(deal)

        # Save to BytesIO
        file_stream = io.BytesIO()
        doc.save(file_stream)
        file_stream.seek(0)

        # Generate filename
        filename = f"Deal_{deal_id}_Analysis_{datetime.now().strftime('%Y%m%d_%H%M%S')}.docx"

        return send_file(
            file_stream,
            mimetype='application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            as_attachment=True,
            download_name=filename
        )
    except ImportError:
        return jsonify({
            'success': False,
            'error': 'Word document generation not available. Please install python-docx: pip install python-docx'
        }), 500
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'Error generating document: {str(e)}'
        }), 500

# ============================================
# Error Handlers
# ============================================

@app.errorhandler(404)
def not_found(error):
    """Handle 404 errors"""
    return jsonify({
        'success': False,
        'error': 'Resource not found'
    }), 404

@app.errorhandler(500)
def internal_error(error):
    """Handle 500 errors"""
    return jsonify({
        'success': False,
        'error': 'Internal server error'
    }), 500

@app.route('/api/sources', methods=['GET'])
def get_sources():
    """Get all sources"""
    conn = deal_model.get_connection()
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT id, name, reliability_rating, total_deals, successful_deals
        FROM sources
        ORDER BY name
    """)

    sources = [dict(row) for row in cursor.fetchall()]
    conn.close()
    
    return jsonify({
        'success': True,
        'sources': sources
    })
# ============================================
# Run the app
# ============================================

if __name__ == '__main__':
    print("=" * 60)
    print("Starting Commodity Deal Tracker")
    print("=" * 60)
    print(f"Dashboard: http://localhost:5000")
    print(f"API Docs: http://localhost:5000/api/deals")
    print("=" * 60)

    app.run(
        host='0.0.0.0',
        port=5000,
        debug=app.config['DEBUG']
    )