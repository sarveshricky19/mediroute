const logger = require('../utils/logger');

/**
 * SOAP connector for legacy ERP system integration.
 * Provides methods to sync inventory with external hospital/distributor ERP systems.
 */
const SoapConnector = {
  /**
   * Create a SOAP client for an ERP endpoint
   */
  async createClient(wsdlUrl) {
    try {
      const soap = require('soap');
      const client = await soap.createClientAsync(wsdlUrl);
      logger.info('SOAP client created', { wsdlUrl });
      return client;
    } catch (error) {
      logger.error('SOAP client creation failed', { wsdlUrl, error: error.message });
      throw error;
    }
  },

  /**
   * Sync inventory data from ERP
   */
  async pullInventory(wsdlUrl, credentials) {
    try {
      const client = await this.createClient(wsdlUrl);

      // Authenticate
      if (credentials) {
        const authHeader = {
          Username: credentials.username,
          Password: credentials.password,
        };
        client.addSoapHeader(authHeader);
      }

      const [result] = await client.GetInventoryAsync({
        warehouseId: credentials.warehouseId,
        lastSyncDate: credentials.lastSyncDate || new Date(0).toISOString(),
      });

      logger.info('ERP inventory pull successful', { itemCount: result?.items?.length || 0 });
      return this.transformErpData(result);
    } catch (error) {
      logger.error('ERP inventory pull failed', { error: error.message });
      return { success: false, error: error.message, items: [] };
    }
  },

  /**
   * Push inventory updates to ERP
   */
  async pushInventoryUpdate(wsdlUrl, credentials, updates) {
    try {
      const client = await this.createClient(wsdlUrl);

      if (credentials) {
        client.addSoapHeader({
          Username: credentials.username,
          Password: credentials.password,
        });
      }

      const payload = {
        updates: updates.map(u => ({
          sku: u.sku,
          quantity: u.quantity,
          batchNumber: u.batchNumber,
          action: u.action || 'update',
        })),
      };

      const [result] = await client.UpdateInventoryAsync(payload);
      logger.info('ERP inventory push successful', { updatedCount: result?.processedCount || 0 });
      return { success: true, ...result };
    } catch (error) {
      logger.error('ERP inventory push failed', { error: error.message });
      return { success: false, error: error.message };
    }
  },

  /**
   * Transform ERP SOAP response to internal format
   */
  transformErpData(erpResponse) {
    if (!erpResponse || !erpResponse.items) {
      return { success: true, items: [] };
    }

    const items = (Array.isArray(erpResponse.items) ? erpResponse.items : [erpResponse.items]).map(item => ({
      sku: item.SKU || item.sku,
      name: item.ItemName || item.name,
      quantity: parseInt(item.AvailableQty || item.quantity || 0, 10),
      batchNumber: item.BatchNo || item.batchNumber,
      expiryDate: item.ExpiryDate ? new Date(item.ExpiryDate) : null,
      unitPrice: parseFloat(item.UnitPrice || item.unitPrice || 0),
      warehouse: item.WarehouseLocation || item.warehouse,
      lastUpdated: item.LastModified ? new Date(item.LastModified) : new Date(),
    }));

    return { success: true, items, syncedAt: new Date().toISOString() };
  },

  /**
   * Generate a mock WSDL for testing
   */
  getMockWsdl() {
    return `<?xml version="1.0" encoding="UTF-8"?>
<definitions name="MediRouteERP" targetNamespace="http://mediroute.example.com/erp"
  xmlns="http://schemas.xmlsoap.org/wsdl/"
  xmlns:soap="http://schemas.xmlsoap.org/wsdl/soap/"
  xmlns:tns="http://mediroute.example.com/erp">
  <message name="GetInventoryRequest">
    <part name="warehouseId" type="xsd:string"/>
    <part name="lastSyncDate" type="xsd:string"/>
  </message>
  <message name="GetInventoryResponse">
    <part name="items" type="xsd:anyType"/>
  </message>
  <portType name="ERPPortType">
    <operation name="GetInventory">
      <input message="tns:GetInventoryRequest"/>
      <output message="tns:GetInventoryResponse"/>
    </operation>
  </portType>
</definitions>`;
  },
};

module.exports = SoapConnector;
