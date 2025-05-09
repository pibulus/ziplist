/**
 * Response Parser Service
 * 
 * Responsible for parsing and sanitizing responses from LLM models
 * Handles various edge cases like markdown code blocks, invalid JSON, etc.
 */

/**
 * Cleans raw response text from code blocks, markdown formatting, etc.
 * @param {string} text - Raw response text from the model
 * @returns {string} Cleaned text with only the useful content
 */
export function cleanResponseText(text) {
  if (!text) return '';
  
  // Remove any markdown code block markers
  let cleaned = text.replace(/```(json|javascript|js)?/g, '');
  
  // Remove any HTML-like tags that might be in the response
  cleaned = cleaned.replace(/<\/?[^>]+(>|$)/g, '');
  
  // Remove any trailing or leading whitespace
  cleaned = cleaned.trim();
  
  return cleaned;
}

/**
 * Attempts to extract a valid JSON object from a potentially malformed response
 * @param {string} text - Raw response text that might contain JSON
 * @returns {object|null} Parsed JSON object or null if parsing failed
 */
export function extractJSON(text) {
  if (!text) return null;
  
  const cleaned = cleanResponseText(text);
  
  // First try: Direct JSON parsing
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    console.warn('First JSON parse attempt failed:', e);
  }
  
  // Second try: Find JSON-like structure within text using regex
  try {
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch && jsonMatch[0]) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    console.warn('Second JSON parse attempt failed:', e);
  }
  
  // Third try: Fix common JSON syntax errors and try again
  try {
    // Fix missing commas between array items
    let fixedText = cleaned.replace(/"\s*"(?!\s*[,\]])/g, '", "');
    
    // Fix trailing commas in arrays/objects
    fixedText = fixedText.replace(/,(\s*[\]}])/g, '$1');
    
    // Try to parse the fixed JSON
    return JSON.parse(fixedText);
  } catch (e) {
    console.warn('Third JSON parse attempt with fixes failed:', e);
  }
  
  // If all parsing attempts fail, return null
  return null;
}

/**
 * Parse items from a model response, with fallbacks for different formats
 * @param {string} responseText - Raw response text from the model
 * @returns {string[]} Array of extracted items
 */
export function parseItemsFromResponse(responseText) {
  if (!responseText) return [];
  
  // Try to extract items from JSON structure first
  const jsonData = extractJSON(responseText);
  
  if (jsonData && jsonData.items && Array.isArray(jsonData.items)) {
    return jsonData.items.filter(item => item && typeof item === 'string');
  }
  
  // Fallback: If JSON parsing fails, try to extract items line by line
  const lines = responseText.split(/\n+/)
    .map(line => {
      // Clean up each line
      let cleaned = line.trim();
      
      // Remove common list markers
      cleaned = cleaned.replace(/^[-•*+]|\d+[.)]|\[\s*\]|\[\s*x\s*\]/, '').trim();
      
      // Remove quotes that might be from a json array
      cleaned = cleaned.replace(/^["']|["']$/g, '').trim();
      
      return cleaned;
    })
    .filter(line => line.length > 0);  // Remove empty lines
  
  return lines;
}

/**
 * Main parser function that handles model responses and extracts useful content
 * @param {string} responseText - Raw response from the model
 * @returns {object} Structured data with parsed items and metadata
 */
export function parseModelResponse(responseText) {
  const items = parseItemsFromResponse(responseText);
  
  return {
    success: items.length > 0,
    items,
    raw: responseText,
    timestamp: new Date().toISOString()
  };
}