-- Add missing transit stages for common import statuses
INSERT INTO "TransitStage" ("stageCode", "stageName", "category", "isTerminal", "displayOrder")
VALUES 
  ('BOOKED', 'Booked', 'PRE_SHIPMENT', false, 1),
  ('LOADED', 'Loaded', 'IN_TRANSIT', false, 5),
  ('IN_TRANSIT', 'In Transit', 'IN_TRANSIT', false, 7),
  ('DISCHARGED', 'Discharged', 'IN_TRANSIT', false, 10),
  ('ARRIVED', 'Arrived', 'ARRIVAL', false, 15),
  ('DELIVERED', 'Delivered', 'DELIVERY', true, 20),
  ('CUSTOMS_CLEARED', 'Customs Cleared', 'ARRIVAL', false, 16),
  ('OUT_FOR_DELIVERY', 'Out for Delivery', 'DELIVERY', false, 18),
  ('EMPTY_RETURNED', 'Empty Returned', 'DELIVERY', true, 25)
ON CONFLICT (stageCode) DO NOTHING;
