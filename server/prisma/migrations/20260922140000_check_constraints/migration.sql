ALTER TABLE "inventory"
  ADD CONSTRAINT inventory_physical_nonneg CHECK ("physicalQty" >= 0),
  ADD CONSTRAINT inventory_reserved_nonneg CHECK ("reservedQty" >= 0),
  ADD CONSTRAINT inventory_damaged_nonneg CHECK ("damagedQty" >= 0),
  ADD CONSTRAINT inventory_reserved_lte_physical CHECK ("reservedQty" + "damagedQty" <= "physicalQty");

ALTER TABLE "enquiry_items"
  ADD CONSTRAINT enquiry_items_qty_positive CHECK ("quantity" > 0);

ALTER TABLE "quotation_items"
  ADD CONSTRAINT quotation_items_qty_positive CHECK ("quantity" > 0),
  ADD CONSTRAINT quotation_items_discount_range CHECK ("discountPercent" >= 0 AND "discountPercent" <= 100),
  ADD CONSTRAINT quotation_items_gst_range CHECK ("gstPercent" >= 0 AND "gstPercent" <= 100),
  ADD CONSTRAINT quotation_items_price_positive CHECK ("unitPrice" > 0);

ALTER TABLE "sales_order_items"
  ADD CONSTRAINT sales_order_items_qty_positive CHECK ("quantity" > 0);

ALTER TABLE "dispatch_items"
  ADD CONSTRAINT dispatch_items_qty_positive CHECK ("quantity" > 0);

ALTER TABLE "products"
  ADD CONSTRAINT products_price_positive CHECK ("basePrice" > 0);
