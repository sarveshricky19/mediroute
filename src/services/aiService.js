const Anthropic = require('@anthropic-ai/sdk');
const config = require('../config');
const logger = require('../utils/logger');

let anthropic = null;

function getClient() {
  if (!anthropic && config.anthropicApiKey) {
    anthropic = new Anthropic({ apiKey: config.anthropicApiKey });
  }
  return anthropic;
}

async function generateDemandForecast(inventoryData) {
  const client = getClient();
  if (!client) {
    logger.warn('Anthropic API key not configured, returning mock forecast');
    return generateMockForecast(inventoryData);
  }

  try {
    const prompt = buildForecastPrompt(inventoryData);
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
      system: `You are a healthcare supply chain AI assistant. Analyze pharmacy inventory data and generate demand forecasts. Respond with JSON containing:
- forecasts: array of objects with {drugName, currentStock, predictedDailyDemand, daysUntilStockout, restockQuantity, restockUrgency (critical/high/medium/low), confidence}
- overallSummary: 2-3 sentence executive summary
- recommendations: array of actionable suggestions
Respond ONLY with valid JSON.`,
    });

    return JSON.parse(response.content[0].text);
  } catch (error) {
    logger.error('AI forecast generation failed', { error: error.message });
    return generateMockForecast(inventoryData);
  }
}

function buildForecastPrompt(inventoryData) {
  const items = inventoryData.map(inv => {
    const salesHistory = (inv.dailySales || []).slice(-14).map(s =>
      `${new Date(s.date).toLocaleDateString()}: ${s.quantity}`
    ).join(', ');

    return `- ${inv.drug.name} (${inv.drug.category}): Current Stock=${inv.quantity}/${inv.maxStock}, MinStock=${inv.minStock}, Price=₹${inv.drug.unitPrice}, Expiry=${inv.expiryDate ? new Date(inv.expiryDate).toLocaleDateString() : 'N/A'}, Recent Sales=[${salesHistory || 'No data'}]`;
  }).join('\n');

  return `Analyze inventory for a pharmacy and forecast demand for the next 7-14 days:

${items}

Based on stock levels, sales history, category patterns, and seasonal healthcare trends in India, predict:
1. Daily demand for each drug
2. Days until stockout
3. Recommended restock quantity
4. Urgency of restocking`;
}

function generateMockForecast(inventoryData) {
  const forecasts = inventoryData.map(inv => {
    const avgDailySales = inv.dailySales && inv.dailySales.length > 0
      ? inv.dailySales.reduce((sum, s) => sum + s.quantity, 0) / inv.dailySales.length
      : Math.max(1, Math.round(inv.maxStock * 0.05));

    const daysUntilStockout = avgDailySales > 0 ? Math.round(inv.quantity / avgDailySales) : 999;
    const restockQuantity = Math.max(0, inv.maxStock - inv.quantity);

    let restockUrgency = 'low';
    if (inv.quantity === 0) restockUrgency = 'critical';
    else if (daysUntilStockout <= 3) restockUrgency = 'critical';
    else if (daysUntilStockout <= 7) restockUrgency = 'high';
    else if (daysUntilStockout <= 14) restockUrgency = 'medium';

    return {
      drugName: inv.drug.name,
      drugId: inv.drugId || inv._id,
      category: inv.drug.category,
      currentStock: inv.quantity,
      maxStock: inv.maxStock,
      predictedDailyDemand: Math.round(avgDailySales),
      daysUntilStockout,
      restockQuantity,
      restockUrgency,
      confidence: inv.dailySales && inv.dailySales.length >= 7 ? 0.75 : 0.4,
    };
  });

  const critical = forecasts.filter(f => f.restockUrgency === 'critical').length;
  const high = forecasts.filter(f => f.restockUrgency === 'high').length;

  return {
    forecasts,
    overallSummary: `Analyzed ${forecasts.length} items. ${critical} require immediate restocking, ${high} need attention within the week. ${forecasts.length > 0 ? `Average days to stockout across catalog: ${Math.round(forecasts.reduce((s, f) => s + f.daysUntilStockout, 0) / forecasts.length)} days.` : ''}`,
    recommendations: [
      critical > 0 ? `Immediately restock ${critical} critical items to avoid stockouts` : null,
      high > 0 ? `Schedule restocking for ${high} high-priority items within 3 days` : null,
      'Review seasonal demand patterns for antibiotics and respiratory drugs',
      'Consider setting up automated purchase orders for high-turnover items',
    ].filter(Boolean),
    generatedAt: new Date().toISOString(),
    source: 'mock',
  };
}

module.exports = { generateDemandForecast };
