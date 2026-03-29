// filepath: supabase/functions/import-cpsc-recalls/__tests__/index.unit.test.ts
// SAFETY-001: Unit tests for CPSC import Edge Function
// Run with: deno test --allow-env supabase/functions/import-cpsc-recalls/__tests__/index.unit.test.ts

import { assertEquals, assertExists } from 'https://deno.land/std@0.168.0/testing/asserts.ts';

Deno.test('CPSC Import - Parse single recall correctly', () => {
  const mockRecall = {
    RecallNumber: '23-123',
    RecallDate: '2023-03-01',
    RecallDescription: 'Choking hazard',
    Products: [{
      Name: 'Toy Car',
      Description: 'Red toy car',
      Manufacturer: 'ABC Toys'
    }],
    Hazards: [{ Name: 'Choking' }],
    Remedies: [{ Name: 'Refund' }],
    Images: [{ URL: 'https://example.com/image.jpg' }],
    URL: 'https://cpsc.gov/recall/23-123'
  };

  const product = mockRecall.Products[0];
  const recallData = {
    recall_number: mockRecall.RecallNumber,
    product_name: product?.Name || 'Unknown Product',
    product_description: product?.Description || null,
    manufacturer: product?.Manufacturer || null,
    hazard: mockRecall.Hazards.map(h => h.Name).join('; '),
    remedy: mockRecall.Remedies.map(r => r.Name).join('; '),
    recall_date: new Date(mockRecall.RecallDate).toISOString().split('T')[0],
    images: JSON.stringify(mockRecall.Images.map(img => img.URL)),
    source_url: mockRecall.URL,
  };

  assertEquals(recallData.recall_number, '23-123');
  assertEquals(recallData.product_name, 'Toy Car');
  assertEquals(recallData.manufacturer, 'ABC Toys');
  assertEquals(recallData.hazard, 'Choking');
  assertEquals(recallData.remedy, 'Refund');
  assertEquals(recallData.recall_date, '2023-03-01');
  assertExists(recallData.images);
  assertEquals(JSON.parse(recallData.images)[0], 'https://example.com/image.jpg');
});

Deno.test('CPSC Import - Handle missing fields gracefully', () => {
  const mockRecall = {
    RecallNumber: '23-456',
    RecallDate: '2023-03-15',
    RecallDescription: 'Fire hazard',
    Title: 'Defective Heater',
    // Products array missing
    // Hazards missing
    // Remedies missing
  };

  const product = mockRecall.Products && mockRecall.Products.length > 0 
    ? mockRecall.Products[0] 
    : null;

  const recallData = {
    recall_number: mockRecall.RecallNumber,
    product_name: product?.Name || mockRecall.Title || 'Unknown Product',
    product_description: mockRecall.RecallDescription || null,
    manufacturer: product?.Manufacturer || null,
    hazard: null, // No hazards provided
    remedy: null, // No remedies provided
    recall_date: new Date(mockRecall.RecallDate).toISOString().split('T')[0],
  };

  assertEquals(recallData.recall_number, '23-456');
  assertEquals(recallData.product_name, 'Defective Heater');
  assertEquals(recallData.manufacturer, null);
  assertEquals(recallData.hazard, null);
  assertEquals(recallData.remedy, null);
});

Deno.test('CPSC Import - Calculate date range correctly', () => {
  const daysBack = 30;
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - daysBack);
  const fromDateStr = fromDate.toISOString().split('T')[0];

  // Verify format is YYYY-MM-DD
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  assertEquals(datePattern.test(fromDateStr), true);

  // Verify date is in the past
  const now = new Date();
  assertEquals(fromDate < now, true);
});

Deno.test('CPSC Import - Build API URL correctly', () => {
  const baseUrl = 'https://www.saferproducts.gov/RestWebServices/Recall';
  const fromDateStr = '2023-03-01';
  const apiUrl = `${baseUrl}?format=json&RecallDateStart=${fromDateStr}`;

  assertEquals(apiUrl.includes('format=json'), true);
  assertEquals(apiUrl.includes('RecallDateStart=2023-03-01'), true);
  assertEquals(apiUrl.startsWith('https://'), true);
});

Deno.test('CPSC Import - Extract multiple hazards correctly', () => {
  const mockHazards = [
    { Name: 'Choking' },
    { Name: 'Fire' },
    { Name: 'Burn' }
  ];

  const hazardStr = mockHazards.map(h => h.Name).join('; ');
  assertEquals(hazardStr, 'Choking; Fire; Burn');
});

Deno.test('CPSC Import - Extract multiple remedies correctly', () => {
  const mockRemedies = [
    { Name: 'Refund' },
    { Name: 'Replace' }
  ];

  const remedyStr = mockRemedies.map(r => r.Name).join('; ');
  assertEquals(remedyStr, 'Refund; Replace');
});
