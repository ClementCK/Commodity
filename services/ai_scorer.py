"""
AI Scoring Service
Uses Claude API to score and analyze commodity deals
"""
import os
import json
from anthropic import Anthropic

class AIScorer:
    """
    AI-powered deal scoring and analysis
    """
    
    def __init__(self, api_key=None):
        """Initialize with Anthropic API key"""
        self.api_key = api_key or os.getenv('ANTHROPIC_API_KEY')
        if not self.api_key:
            raise ValueError("ANTHROPIC_API_KEY not found")
        
        self.client = Anthropic(api_key=self.api_key)
        self.model = "claude-sonnet-4-5-20250929"  # Claude Sonnet 4.5 (latest)
    
    def score_deal(self, deal_data):
        """
        Score a commodity deal and provide reasoning
        
        Args:
            deal_data: Dictionary with deal information
        
        Returns:
            Dictionary with score and reasoning
        """
        
        prompt = self._build_scoring_prompt(deal_data)
        
        try:
            message = self.client.messages.create(
                model=self.model,
                max_tokens=16000,  # Increased for comprehensive analysis
                temperature=0.7,  # Higher for more expansive, detailed responses
                system=self._get_system_prompt(),
                messages=[
                    {"role": "user", "content": prompt}
                ]
            )
            
            response_text = message.content[0].text
            result = self._parse_score_response(response_text)
            
            return {
                'success': True,
                'score': result['score'],
                'reasoning': result['reasoning'],
                'recommendation': result.get('recommendation', ''),
                'risk_level': result.get('risk_level', 'medium')
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'score': None,
                'reasoning': []
            }
    
    def _get_system_prompt(self):
        """System prompt with commodity trading expertise"""
        return """You are an expert commodity trading advisor with 20+ years of experience in metals, agricultural products, energy, and crypto trading.

EXPERTISE AREAS:
• Commodities: Gold, copper, aluminum, iron ore, wheat, soybean, oil, petroleum coke, crypto
• Payment Methods: SBLC, LC, BCL, DLC, wire transfers
• Shipping: CIF, FOB, DDP, and other Incoterms
• Benchmarks: LME, COMEX, spot markets
• Compliance: Export licenses, sanctions, regulatory requirements
• Risk Assessment: Origin analysis, fraud detection, buyer profiling

YOUR TASK:
Provide DETAILED and FOCUSED analysis of commodity deals. Write clear, informative assessments that cover all angles efficiently. Each section should be substantial but concise. Keep analysis sections to 2-4 paragraphs each.

ANALYSIS SECTIONS (write 2-3 focused paragraphs for each):

1. EXECUTIVE SUMMARY
   Write a clear overview (2-3 paragraphs) covering:
   - Overall deal assessment and strategic value
   - Key opportunities and risks identified
   - Market positioning and competitive advantages
   - Primary concerns and considerations
   - Clear, detailed recommendation with reasoning

2. MARKET ANALYSIS
   Provide focused market intelligence (2-3 paragraphs):
   - Current market conditions for this specific commodity
   - Recent price trends, volatility patterns, and historical context
   - Supply and demand dynamics globally and regionally
   - Major market events, strikes, policy changes affecting prices
   - Seasonal factors and cyclical patterns
   - Future outlook and market sentiment

3. ORIGIN ANALYSIS
   Write focused origin assessment (2-3 paragraphs):
   - Country/region specific factors and political stability
   - Regulatory environment and required licenses/permits
   - Export restrictions and recent developments
   - Logistical challenges and supplier reliability

4. BUYER PROFILE
   Provide clear buyer analysis (2-3 paragraphs):
   - Who typically purchases this commodity and why
   - End-use applications and demand drivers
   - Quality specifications and volume expectations
   - Why this deal would or wouldn't appeal to buyers

5. PRICE ANALYSIS
   Write clear pricing assessment (2-3 paragraphs):
   - Comparison to market benchmarks (LME, COMEX, spot)
   - Specific calculations and historical context
   - Discount/premium analysis with explanations
   - Fair value assessment and pricing realism

6. PAYMENT & LOGISTICS ASSESSMENT
   Provide focused analysis (2-3 paragraphs):
   - Payment method appropriateness and risk assessment
   - Shipping terms and logistics considerations
   - Industry standard practices comparison
   - Timeline, delivery expectations, and potential bottlenecks

7. RED FLAGS & UNUSUAL PATTERNS
   List ALL concerns identified (aim for comprehensive lists):
   - Anything that doesn't align with market norms
   - Pricing anomalies or suspiciously good deals
   - Documentation gaps or inconsistencies
   - Unusual payment terms or pressure tactics
   - Compliance and regulatory concerns
   - Verification challenges
   - Vague or evasive information
   - Potential fraud indicators

8. STRENGTHS & POSITIVE ASPECTS
   List ALL positive elements (comprehensive):
   - What makes this deal attractive
   - Competitive advantages
   - Strong documentation or credentials
   - Favorable terms or conditions
   - Market timing benefits

9. NEXT STEPS & RECOMMENDATIONS
   Provide detailed action plan (comprehensive list):
   - Specific verification steps needed
   - Detailed questions to ask supplier
   - Documentation to request
   - Due diligence procedures
   - Market research to conduct
   - Expert consultations needed
   - Deal structure improvements
   - Negotiation strategies

SCORING CRITERIA (0-100):
• Source Reliability (25%): 8-10 rating=20-25pts, 5-7=12-19pts, 0-4=0-11pts
• Price Competitiveness (25%): Market-aligned=good; >18% below=RED FLAG (Gold: LME -8 to -12% normal for African origin)
• Payment Terms (20%): DLC/LC=15-20pts, SBLC=12-18pts, BCL=10-15pts, Wire=5-10pts
• Compliance (15%): Required licenses present=full points, missing=deductions
• Logistics (10%): Clear Incoterms and logical routes=full points
• Deal Completeness (5%): All information provided=full points

CRITICAL RED FLAGS (subtract 20-30 points each):
• Prices 20%+ below market without clear explanation
• Sanctioned banks or countries involved
• Missing required licenses or permits
• High-pressure tactics or urgency without reason
• Vague supplier details or unverifiable claims

OUTPUT FORMAT:

CRITICAL: You MUST respond with ONLY a valid JSON object. Do NOT include any text before or after the JSON. Do NOT use markdown code blocks. Start your response with { and end with }.

{
  "score": 75,
  "executive_summary": "Write multiple detailed paragraphs providing comprehensive overview of the deal, opportunities, risks, and clear recommendation",
  "market_analysis": "Write multiple detailed paragraphs about current market conditions, trends, supply/demand, events, and outlook",
  "origin_analysis": "Write multiple detailed paragraphs about the country, political factors, regulations, licenses, and recent developments",
  "buyer_profile": "Write multiple detailed paragraphs about typical buyers, industries, demand drivers, and deal appeal",
  "price_analysis": "Write multiple detailed paragraphs comparing to benchmarks, explaining discounts/premiums, and fair value assessment",
  "payment_logistics": "Write multiple detailed paragraphs about payment method, shipping terms, risks, and industry standards",
  "red_flags": ["Detailed specific concern 1", "Detailed specific concern 2", "etc - be comprehensive"],
  "unusual_patterns": ["Detailed unusual aspect 1", "Detailed unusual aspect 2", "etc"],
  "strengths": ["Detailed positive 1", "Detailed positive 2", "etc - be comprehensive"],
  "next_steps": ["Detailed action 1", "Detailed action 2", "Detailed action 3", "etc - aim for 8-12 items"],
  "recommendation": "Write a clear, detailed recommendation paragraph",
  "risk_level": "low/medium/high",
  "reasoning": [
    "POSITIVE: Detailed positive point with specific numbers and facts",
    "CONCERN: Detailed concern with full context and implications",
    "INFO: Important detailed information",
    "etc - aim for 6-10 reasoning points"
  ]
}

CRITICAL INSTRUCTIONS:
✓ WRITE FOCUSED, PROFESSIONAL ANALYSIS with 2-3 paragraphs per section
✓ Include specific numbers, dates, and facts
✓ Reference actual market conditions and benchmarks
✓ Provide ACTIONABLE insights with clear reasoning
✓ Consider geopolitical and economic context
✓ Be thorough but concise - aim for clarity and substance
✗ Do NOT write excessively long responses that may get truncated
✗ Do NOT omit important details
✗ Do NOT use vague or generic statements
✗ Do NOT repeat information across sections"""

    def _build_scoring_prompt(self, deal_data):
        """Build the user prompt with deal details"""
        
        # Format price display
        if deal_data.get('price_type') == 'lme_discount':
            price_info = f"LME Discount Pricing - Gross: {deal_data.get('gross_discount')}%, Commission: {deal_data.get('commission')}%, Net: {deal_data.get('net_discount')}%"
        elif deal_data.get('price'):
            price_info = f"{deal_data.get('price')} {deal_data.get('price_currency', 'USD')}"
        else:
            price_info = "Not specified"
        
        prompt = f"""Analyze this commodity trading deal and provide COMPREHENSIVE, DETAILED analysis.

**DEAL DETAILS:**
Commodity: {deal_data.get('commodity_type', 'Not specified')}
Source: {deal_data.get('source_name', 'Unknown')} (Reliability: {deal_data.get('source_reliability', 'N/A')}/10)
Price: {price_info}
Quantity: {deal_data.get('quantity', 'Not specified')} {deal_data.get('quantity_unit', '')}
Origin: {deal_data.get('origin_country', 'Not specified')}
Payment Method: {deal_data.get('payment_method', 'Not specified')}
Shipping Terms: {deal_data.get('shipping_terms', 'Not specified')}

**RAW DEAL TEXT:**
{deal_data.get('deal_text', 'No additional details provided')}

**ADDITIONAL NOTES:**
{deal_data.get('additional_notes', 'None')}

Provide a professional analysis with:
- Focused 2-3 paragraph assessments for each section
- Specific numbers, facts, and market context
- Clear lists of risks, strengths, and action items (5-8 items each)
- Score from 0-100 based on the scoring criteria

Return your analysis as a valid JSON object following the exact format specified in the system prompt. Keep responses concise to avoid truncation."""
        
        return prompt
    
    def _parse_score_response(self, response_text):
        """Parse Claude's JSON response"""
        try:
            # Save raw response for debugging (avoid encoding issues)
            try:
                print("\n" + "="*60)
                print("RAW AI RESPONSE:")
                print("="*60)
                print(response_text[:500])  # Print first 500 chars
                print("="*60 + "\n")
            except UnicodeEncodeError:
                # Skip printing if console can't handle Unicode
                pass

            cleaned = response_text.strip()

            # Remove markdown code blocks
            if cleaned.startswith('```json'):
                cleaned = cleaned[7:]
            elif cleaned.startswith('```'):
                cleaned = cleaned[3:]

            if cleaned.endswith('```'):
                cleaned = cleaned[:-3]

            cleaned = cleaned.strip()

            # Try to find JSON object if there's extra text
            import re
            json_match = re.search(r'\{[\s\S]*\}', cleaned)
            if json_match:
                cleaned = json_match.group(0)

            result = json.loads(cleaned)

            if 'score' not in result:
                raise ValueError("Response missing 'score' field")

            result['score'] = max(0, min(100, int(result['score'])))

            defaults = {
                'executive_summary': 'Analysis in progress...',
                'market_analysis': 'Market data being analyzed...',
                'origin_analysis': 'Origin analysis pending...',
                'buyer_profile': 'Buyer analysis pending...',
                'price_analysis': 'Price analysis pending...',
                'payment_logistics': 'Payment analysis pending...',
                'red_flags': [],
                'unusual_patterns': [],
                'strengths': [],
                'next_steps': [],
                'reasoning': [],
                'recommendation': 'Review detailed analysis',
                'risk_level': 'medium'
            }

            for key, default_value in defaults.items():
                if key not in result:
                    result[key] = default_value

            try:
                print("Successfully parsed AI response")
            except:
                pass
            return result

        except json.JSONDecodeError as e:
            try:
                print(f"\nJSON PARSING ERROR: {e}")
                print(f"Attempted to parse: {cleaned[:200]}...")
            except:
                pass

            # Try to extract score
            import re
            score_match = re.search(r'"score"\s*:\s*(\d+)', response_text)
            score = int(score_match.group(1)) if score_match else 50

            # Return the raw response so user can see what went wrong
            return {
                'score': score,
                'executive_summary': f'Warning: JSON Parsing Error. Raw response:\n\n{response_text[:1000]}',
                'market_analysis': 'See Executive Summary for raw AI response',
                'origin_analysis': 'See Executive Summary for raw AI response',
                'buyer_profile': 'See Executive Summary for raw AI response',
                'price_analysis': 'See Executive Summary for raw AI response',
                'payment_logistics': 'See Executive Summary for raw AI response',
                'red_flags': [f'JSON parsing failed: {str(e)}'],
                'unusual_patterns': [],
                'strengths': [],
                'next_steps': ['Check server console for full response', 'Try re-running analysis'],
                'reasoning': ['Warning: AI returned invalid JSON format'],
                'recommendation': 'Check console output or try again',
                'risk_level': 'medium'
            }
        except Exception as e:
            try:
                print(f"\nUNEXPECTED ERROR: {e}")
            except:
                pass
            return {
                'score': 50,
                'executive_summary': f'Warning: Error: {str(e)}',
                'market_analysis': 'Error occurred',
                'origin_analysis': 'Error occurred',
                'buyer_profile': 'Error occurred',
                'price_analysis': 'Error occurred',
                'payment_logistics': 'Error occurred',
                'red_flags': [str(e)],
                'unusual_patterns': [],
                'strengths': [],
                'next_steps': ['Check error message', 'Try again'],
                'reasoning': ['Warning: Unexpected error occurred'],
                'recommendation': 'Try running analysis again',
                'risk_level': 'medium'
            }