import { authenticate } from "../shopify.server";
import {
  DndContext,
  closestCenter,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Page,
  Layout,
  Card,
  Text,
  TextField,
  Button,
  BlockStack,
  Checkbox,
  InlineStack,
  Banner,
  RadioButton,
  Box,
  Icon,
} from "@shopify/polaris";
import {
  Form,
  useLoaderData,
  useNavigate,
} from "react-router";
import { useState } from "react";
import { redirect } from "react-router";
import prisma from "../db.server";

function SortableDropdownItem({
  id,
  value,
  index,
  updateDropdownValue,
  removeDropdownValue,
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    display: "flex",
    alignItems: "center",
    gap: "12px",
    marginBottom: "10px",
  };

  return (
    <div ref={setNodeRef} style={style}>
      <div
        {...attributes}
        {...listeners}
        style={{
          cursor: "grab",
          padding: "8px",
          userSelect: "none",
        }}
      >
        ☰
      </div>
      <div style={{ flex: 1 }}>
        <TextField
          label={`Value ${index + 1}`}
          labelHidden
          type="number"
          value={value}
          autoComplete="off"
          onChange={(val) => updateDropdownValue(index, val)}
        />
      </div>
      <Button destructive onClick={() => removeDropdownValue(index)}>
        Delete
      </Button>
    </div>
  );
}

function SortableSwatchItem({
  id,
  value,
  index,
  updateSwatchValue,
  removeSwatchValue,
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    display: "flex",
    alignItems: "center",
    gap: "12px",
    marginBottom: "10px",
  };

  return (
    <div ref={setNodeRef} style={style}>
      <div
        {...attributes}
        {...listeners}
        style={{
          cursor: "grab",
          padding: "8px",
          userSelect: "none",
        }}
      >
        ☰
      </div>
      <div style={{ flex: 1 }}>
        <TextField
          label={`Swatch Value ${index + 1}`}
          labelHidden
          type="number"
          value={value}
          autoComplete="off"
          onChange={(val) => updateSwatchValue(index, val)}
        />
      </div>
      <Button destructive onClick={() => removeSwatchValue(index)}>
        Delete
      </Button>
    </div>
  );
}

// NEW: live preview of the swatch button in its normal, hover, and
// active states, using the colors currently set in the form - so the
// merchant can see what they're picking before saving.
function SwatchColorPreview({ colors }) {
  const [hovered, setHovered] = useState(false);

  const baseButtonStyle = {
    padding: "8px 16px",
    borderRadius: "6px",
    fontSize: "14px",
    fontWeight: 500,
    cursor: "pointer",
    minWidth: "40px",
    textAlign: "center",
  };

  return (
    <InlineStack gap="300" blockAlign="center">
      <div>
        <Text as="p" tone="subdued" variant="bodySm">Normal / hover</Text>
        <button
          type="button"
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          style={{
            ...baseButtonStyle,
            border: `2px solid ${hovered ? colors.hoverBorder : colors.border}`,
            background: hovered ? colors.hover : colors.bg,
            color: colors.text,
          }}
        >
          5 pcs
        </button>
      </div>
      <div>
        <Text as="p" tone="subdued" variant="bodySm">Active (selected)</Text>
        <button
          type="button"
          style={{
            ...baseButtonStyle,
            border: `2px solid ${colors.activeBorder}`,
            background: colors.active,
            color: colors.activeText,
          }}
        >
          10 pcs
        </button>
      </div>
    </InlineStack>
  );
}

export async function loader({ request, params }) {
  const rule = await prisma.wholesaleRule.findUnique({
    where: {
      id: params.id,
    },
    include: {
      products: true,
      slabs: true,
    },
  });
  const { admin } = await authenticate.admin(request);
  
  if (!rule) {
    return redirect("/app/rules");
  }

  // Get all used variant IDs from other rules (excluding current rule)
  const otherRules = await prisma.wholesaleRule.findMany({
    where: {
      id: {
        not: params.id,
      },
    },
    include: {
      products: true,
    },
  });

  const usedVariantIds = otherRules.flatMap(rule =>
    rule.products.map(product => product.variantId)
  );

  // Fetch product details for the rule's products
  let productTitles = {};
  if (rule.products.length > 0) {
    try {
      const variantIds = rule.products.map(p => p.variantId);
      
      // Fetch variants with product info using GraphQL
      const response = await admin.graphql(`
        query getVariants($ids: [ID!]!) {
          nodes(ids: $ids) {
            ... on ProductVariant {
              id
              title
              displayName
              product {
                title
              }
            }
          }
        }
      `, {
        variables: {
          ids: variantIds,
        },
      });

      const data = await response.json();
      
      if (data.data && data.data.nodes) {
        data.data.nodes.forEach((node) => {
          if (node && node.id) {
            // Use displayName (which is already formatted) or fallback to manual formatting
            productTitles[node.id] = 
              node.displayName ||
              `${node.product?.title} - ${node.title}` ||
              node.id;
          }
        });
      }
    } catch (error) {
      console.error('Error fetching product titles:', error);
    }
  }

  // Determine quantity input type
  let quantityInputType = "default";
  if (rule.quantityInputEnabled) {
    quantityInputType = "dropdown";
  } else if (rule.quantitySwatchEnabled) {
    quantityInputType = "swatch";
  }

  return { 
    rule,
    usedVariantIds,
    currentVariantIds: rule.products.map(p => p.variantId),
    productTitles,
    quantityInputType,
  };
}

export async function action({ request, params }) {
  const formData = await request.formData();
  const widgetHeading = formData.get("widgetHeading");
  const backgroundColor = formData.get("backgroundColor");
  const borderColor = formData.get("borderColor");
  const textColor = formData.get("textColor");
  const highlightColor = formData.get("highlightColor");
  
  // NEW: swatch color fields - these feed the widget's
  // .wholesale-swatch-button CSS variables (background/border/text,
  // hover, and active states).
  const swatchColor = formData.get("swatchColor");
  const swatchBorderColor = formData.get("swatchBorderColor");
  const swatchTextColor = formData.get("swatchTextColor");
  const swatchHoverColor = formData.get("swatchHoverColor");
  const swatchHoverBorderColor = formData.get("swatchHoverBorderColor");
  const swatchActiveColor = formData.get("swatchActiveColor");
  const swatchActiveBorderColor = formData.get("swatchActiveBorderColor");
  const swatchActiveTextColor = formData.get("swatchActiveTextColor");
  
  const actionType = formData.get("action");

  if (actionType === "delete") {
    const rule = await prisma.wholesaleRule.findUnique({
      where: {
        id: params.id,
      },
    });

    if (rule?.discountId) {
      const { admin } = await authenticate.admin(request);
      await admin.graphql(`
        mutation discountAutomaticDelete($id: ID!) {
          discountAutomaticDelete(id: $id) {
            deletedAutomaticDiscountId
            userErrors {
              field
              message
            }
          }
        }
      `, {
        variables: {
          id: rule.discountId,
        },
      });
    }

    await prisma.ruleProduct.deleteMany({
      where: {
        ruleId: params.id,
      },
    });

    await prisma.pricingSlab.deleteMany({
      where: {
        ruleId: params.id,
      },
    });

    await prisma.wholesaleRule.delete({
      where: {
        id: params.id,
      },
    });

    return redirect("/app/rules");
  }

  const name = formData.get("name");
  const enabled = formData.get("enabled") === "true";
  const existingRule = await prisma.wholesaleRule.findUnique({
    where: {
      id: params.id,
    },
  });
  
  // Get quantity input type
  const quantityInputType = formData.get("quantityInputType") || "default";
  const quantityDropdownEnabled = quantityInputType === "dropdown";
  const quantitySwatchEnabled = quantityInputType === "swatch";
  
  const dropdownValues = [
    ...new Set(
      formData
        .get("dropdownValues")
        ?.split(",")
        .map(v => Number(v.trim()))
        .filter(Boolean)
    ),
  ];
  
  const swatchValues = [
    ...new Set(
      formData
        .get("swatchValues")
        ?.split(",")
        .map(v => Number(v.trim()))
        .filter(Boolean)
    ),
  ];
  
  const products = JSON.parse(formData.get("products") || "[]");
  const slabs = JSON.parse(formData.get("slabs") || "[]");

  await prisma.ruleProduct.deleteMany({
    where: {
      ruleId: params.id,
    },
  });

  await prisma.pricingSlab.deleteMany({
    where: {
      ruleId: params.id,
    },
  });

  const updatedRule = await prisma.wholesaleRule.update({
    where: {
      id: params.id,
    },
    data: {
      name,
      enabled,
      quantityInputEnabled: quantityDropdownEnabled,
      quantitySwatchEnabled: quantitySwatchEnabled,
      quantityDropdown: dropdownValues,
      quantitySwatch: swatchValues,
      widgetConfig: {
        heading: widgetHeading,
        backgroundColor,
        borderColor,
        textColor,
        highlightColor,
        // NEW: swatch styling, read by the storefront widget's
        // applySwatchTheme() and applied as CSS variables.
        swatchColor,
        swatchBorderColor,
        swatchTextColor,
        swatchHoverColor,
        swatchHoverBorderColor,
        swatchActiveColor,
        swatchActiveBorderColor,
        swatchActiveTextColor,
      },
      products: {
        create: products.map((variant) => ({
          productId: variant.productId,
          variantId: variant.variantId,
        })),
      },
      slabs: {
        create: slabs.map((slab) => ({
          minQty: Number(slab.minQty),
          maxQty: slab.maxQty ? Number(slab.maxQty) : null,
          price: Number(slab.price),
        })),
      },
    },
  });

  // CREATE SHOPIFY DISCOUNT if enabled and no discount exists
  if (enabled && !existingRule?.discountId) {
    const { admin } = await authenticate.admin(request);

    const response = await admin.graphql(`
      mutation discountAutomaticAppCreate(
        $automaticAppDiscount: DiscountAutomaticAppInput!
      ) {
        discountAutomaticAppCreate(
          automaticAppDiscount: $automaticAppDiscount
        ) {
          automaticAppDiscount {
            discountId
          }
          userErrors {
            field
            message
          }
        }
      }
    `, {
      variables: {
        automaticAppDiscount: {
          title: name,
          combinesWith: {
            productDiscounts: true,
            orderDiscounts: false,
            shippingDiscounts: false,
          },
          functionHandle: "wholesale-discount",
          startsAt: new Date(),
          metafields: [
            {
              namespace: "app",
              key: "function-configuration",
              type: "json",
              value: JSON.stringify({
                variantIds: products.map((product) => product.variantId),
                slabs: slabs.map((slab) => ({
                  minQty: Number(slab.minQty),
                  maxQty: slab.maxQty ? Number(slab.maxQty) : null,
                  discountPrice: Number(slab.price),
                })),
              })
            },
          ],
        },
      },
    });

    const data = await response.json();
    console.log(JSON.stringify(data, null, 2));

    const discountId = data.data.discountAutomaticAppCreate.automaticAppDiscount.discountId;

    await prisma.wholesaleRule.update({
      where: {
        id: params.id,
      },
      data: {
        discountId,
      },
    });

    return redirect("/app/rules");
  }

  // DELETE Shopify discount if disabled
  if (existingRule?.discountId && !enabled) {
    const { admin } = await authenticate.admin(request);
    await admin.graphql(`
      mutation discountAutomaticDelete($id: ID!) {
        discountAutomaticDelete(id: $id) {
          deletedAutomaticDiscountId
          userErrors {
            field
            message
          }
        }
      }
    `, {
      variables: {
        id: existingRule.discountId,
      },
    });

    await prisma.wholesaleRule.update({
      where: {
        id: params.id,
      },
      data: {
        discountId: null,
      },
    });

    return redirect("/app/rules");
  }

  // UPDATE Shopify discount if enabled and discount exists
  if (existingRule?.discountId && enabled) {
    const { admin } = await authenticate.admin(request);

    const response = await admin.graphql(`
      mutation discountAutomaticAppUpdate(
        $id: ID!,
        $automaticAppDiscount: DiscountAutomaticAppInput!
      ) {
        discountAutomaticAppUpdate(
          id: $id,
          automaticAppDiscount: $automaticAppDiscount
        ) {
          automaticAppDiscount {
            discountId
          }
          userErrors {
            field
            message
          }
        }
      }
    `, {
      variables: {
        id: existingRule.discountId,
        automaticAppDiscount: {
          title: name,
          combinesWith: {
            productDiscounts: true,
            orderDiscounts: false,
            shippingDiscounts: false,
          },
          functionHandle: "wholesale-discount",
          startsAt: new Date(),
          metafields: [
            {
              namespace: "app",
              key: "function-configuration",
              type: "json",
              value: JSON.stringify({
                variantIds: products.map((product) => product.variantId),
                slabs: slabs.map((slab) => ({
                  minQty: Number(slab.minQty),
                  maxQty: slab.maxQty ? Number(slab.maxQty) : null,
                  discountPrice: Number(slab.price),
                })),
              })
            },
          ],
        },
      },
    });

    const data = await response.json();
    console.log(JSON.stringify(data, null, 2));
  }

  return redirect("/app/rules");
}

export default function EditRulePage() {
  const navigate = useNavigate();
  const { rule, usedVariantIds, currentVariantIds, productTitles, quantityInputType: initialQuantityType } = useLoaderData();
  const [skippedCount, setSkippedCount] = useState(0);

  const [name, setName] = useState(rule.name);
  const [enabled, setEnabled] = useState(rule.enabled);
  
  // Quantity input type: 'default', 'dropdown', 'swatch'
  const [quantityInputType, setQuantityInputType] = useState(initialQuantityType || "default");

  // Convert saved dropdown values to the same format as create page
  const [dropdownValues, setDropdownValues] = useState(
    rule.quantityDropdown && rule.quantityDropdown.length > 0
      ? rule.quantityDropdown.map(val => ({
          id: crypto.randomUUID(),
          value: String(val),
        }))
      : [
          { id: crypto.randomUUID(), value: "5" },
          { id: crypto.randomUUID(), value: "10" },
          { id: crypto.randomUUID(), value: "20" },
          { id: crypto.randomUUID(), value: "50" },
        ]
  );

  // Convert saved swatch values to the same format as create page
  const [swatchValues, setSwatchValues] = useState(
    rule.quantitySwatch && rule.quantitySwatch.length > 0
      ? rule.quantitySwatch.map(val => ({
          id: crypto.randomUUID(),
          value: String(val),
        }))
      : [
          { id: crypto.randomUUID(), value: "5" },
          { id: crypto.randomUUID(), value: "10" },
          { id: crypto.randomUUID(), value: "20" },
          { id: crypto.randomUUID(), value: "50" },
        ]
  );

  const [widgetHeading, setWidgetHeading] = useState(
    rule.widgetConfig?.heading || "Wholesale Pricing"
  );
  const [backgroundColor, setBackgroundColor] = useState(
    rule.widgetConfig?.backgroundColor || "#ffffff"
  );
  const [borderColor, setBorderColor] = useState(
    rule.widgetConfig?.borderColor || "#d9d9d9"
  );
  const [textColor, setTextColor] = useState(
    rule.widgetConfig?.textColor || "#000000"
  );
  const [highlightColor, setHighlightColor] = useState(
    rule.widgetConfig?.highlightColor || "#d1fadf"
  );

  // NEW: swatch color state - defaults match the widget's own CSS
  // fallback values, so an unedited rule looks identical to before.
  const [swatchColor, setSwatchColor] = useState(
    rule.widgetConfig?.swatchColor || "#ffffff"
  );
  const [swatchBorderColor, setSwatchBorderColor] = useState(
    rule.widgetConfig?.swatchBorderColor || "#d9d9d9"
  );
  const [swatchTextColor, setSwatchTextColor] = useState(
    rule.widgetConfig?.swatchTextColor || "#000000"
  );
  const [swatchHoverColor, setSwatchHoverColor] = useState(
    rule.widgetConfig?.swatchHoverColor || "#f5f5f5"
  );
  const [swatchHoverBorderColor, setSwatchHoverBorderColor] = useState(
    rule.widgetConfig?.swatchHoverBorderColor || "#999999"
  );
  const [swatchActiveColor, setSwatchActiveColor] = useState(
    rule.widgetConfig?.swatchActiveColor || "#000000"
  );
  const [swatchActiveBorderColor, setSwatchActiveBorderColor] = useState(
    rule.widgetConfig?.swatchActiveBorderColor || "#000000"
  );
  const [swatchActiveTextColor, setSwatchActiveTextColor] = useState(
    rule.widgetConfig?.swatchActiveTextColor || "#ffffff"
  );

  // Initialize products with titles from loader data
  const [products, setProducts] = useState(
    rule.products.map((p) => ({
      productId: p.productId,
      variantId: p.variantId,
      title: productTitles[p.variantId] || `Variant: ${p.variantId}`,
    }))
  );

  const [slabs, setSlabs] = useState(
    rule.slabs.map(slab => ({
      minQty: String(slab.minQty),
      maxQty: slab.maxQty ? String(slab.maxQty) : "",
      price: String(slab.price),
    }))
  );

  function updateSlab(index, field, value) {
    const updated = [...slabs];
    updated[index][field] = value;
    setSlabs(updated);
  }

  function addSlab() {
    setSlabs([
      ...slabs,
      {
        minQty: "",
        maxQty: "",
        price: "",
      },
    ]);
  }

  // Dropdown handlers
  function handleDragEnd(event) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = dropdownValues.findIndex(item => item.id === active.id);
    const newIndex = dropdownValues.findIndex(item => item.id === over.id);

    setDropdownValues(arrayMove(dropdownValues, oldIndex, newIndex));
  }

  function addDropdownValue() {
    setDropdownValues([
      ...dropdownValues,
      {
        id: crypto.randomUUID(),
        value: "",
      },
    ]);
  }

  function updateDropdownValue(index, value) {
    const updated = [...dropdownValues];
    updated[index].value = value;
    setDropdownValues(updated);
  }

  function removeDropdownValue(index) {
    setDropdownValues(dropdownValues.filter((_, i) => i !== index));
  }

  // Swatch handlers
  function handleSwatchDragEnd(event) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = swatchValues.findIndex(item => item.id === active.id);
    const newIndex = swatchValues.findIndex(item => item.id === over.id);

    setSwatchValues(arrayMove(swatchValues, oldIndex, newIndex));
  }

  function addSwatchValue() {
    setSwatchValues([
      ...swatchValues,
      {
        id: crypto.randomUUID(),
        value: "",
      },
    ]);
  }

  function updateSwatchValue(index, value) {
    const updated = [...swatchValues];
    updated[index].value = value;
    setSwatchValues(updated);
  }

  function removeSwatchValue(index) {
    setSwatchValues(swatchValues.filter((_, i) => i !== index));
  }

  function removeProduct(variantId) {
    setProducts(products.filter(product => product.variantId !== variantId));
  }

  async function openProductPicker() {
    const selected = await shopify.resourcePicker({
      type: "product",
      multiple: true,
      selectionIds: products.map(product => ({
        id: product.productId
      })),
      filter: {
        variants: true,
      },
    });

    if (!selected) return;

    const formatted = [];
    let skipped = 0;

    selected.forEach((product) => {
      product.variants.forEach((variant) => {
        // Skip if variant is used in other rules but allow current rule's variants
        if (usedVariantIds.includes(variant.id) && 
            !currentVariantIds.includes(variant.id)) {
          skipped++;
          return;
        }

        formatted.push({
          productId: product.id,
          variantId: variant.id,
          title: `${product.title} - ${variant.title}`,
        });
      });
    });

    setSkippedCount(skipped);

    const merged = [...products, ...formatted];
    const uniqueProducts = [];
    const ids = new Set();

    merged.forEach(product => {
      if (ids.has(product.variantId)) return;
      ids.add(product.variantId);
      uniqueProducts.push(product);
    });

    setProducts(uniqueProducts.sort((a, b) => a.title.localeCompare(b.title)));
  }

  return (
    <Page
      title="Edit Wholesale Rule"
      backAction={{
        content: "Rules",
        onAction: () => navigate("/app/rules"),
      }}
    >
      <Form method="post">
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <TextField
                  label="Rule Name"
                  value={name}
                  onChange={setName}
                  autoComplete="off"
                />

                <input type="hidden" name="name" value={name} />
                <input type="hidden" name="enabled" value={enabled} />
                <input type="hidden" name="widgetHeading" value={widgetHeading} />
                <input type="hidden" name="backgroundColor" value={backgroundColor} />
                <input type="hidden" name="borderColor" value={borderColor} />
                <input type="hidden" name="textColor" value={textColor} />
                <input type="hidden" name="highlightColor" value={highlightColor} />
                {/* NEW: swatch color hidden fields, submitted with the rest of the form */}
                <input type="hidden" name="swatchColor" value={swatchColor} />
                <input type="hidden" name="swatchBorderColor" value={swatchBorderColor} />
                <input type="hidden" name="swatchTextColor" value={swatchTextColor} />
                <input type="hidden" name="swatchHoverColor" value={swatchHoverColor} />
                <input type="hidden" name="swatchHoverBorderColor" value={swatchHoverBorderColor} />
                <input type="hidden" name="swatchActiveColor" value={swatchActiveColor} />
                <input type="hidden" name="swatchActiveBorderColor" value={swatchActiveBorderColor} />
                <input type="hidden" name="swatchActiveTextColor" value={swatchActiveTextColor} />
                <input type="hidden" name="products" value={JSON.stringify(products)} />
                <input type="hidden" name="slabs" value={JSON.stringify(slabs)} />
                <input type="hidden" name="quantityInputType" value={quantityInputType} />
                <input type="hidden" name="dropdownValues" value={dropdownValues.map(item => item.value).join(",")} />
                <input type="hidden" name="swatchValues" value={swatchValues.map(item => item.value).join(",")} />

                <Checkbox
                  label="Enable Rule"
                  checked={enabled}
                  onChange={setEnabled}
                />

                <BlockStack gap="300">
                  <Text as="h3" variant="headingMd">
                    Products
                  </Text>
                  <Text as="p" tone="subdued">
                    Selected Variants: {products.length}
                  </Text>

                  {skippedCount > 0 && (
                    <Banner tone="warning">
                      {skippedCount} variant(s) were skipped because they are already used in another wholesale rule.
                    </Banner>
                  )}

                  <Button onClick={openProductPicker}>
                    Select Products
                  </Button>

                  {products.length === 0 && (
                    <Text as="p" tone="subdued">
                      No variants selected.
                    </Text>
                  )}

                  {products.map((product) => (
                    <Card key={product.variantId}>
                      <InlineStack align="space-between" blockAlign="center">
                        <Text as="p">{product.title}</Text>
                        <Button
                          tone="critical"
                          size="slim"
                          onClick={() => {
                            if (window.confirm("Are you sure you want to remove this variant?")) {
                              removeProduct(product.variantId);
                            }
                          }}
                        >
                          Remove
                        </Button>
                      </InlineStack>
                    </Card>
                  ))}
                </BlockStack>

                <BlockStack gap="300">
                  <Text as="h3" variant="headingMd">
                    Quantity Input Type
                  </Text>
                  <Text as="p" tone="subdued">
                    Choose how customers will select quantity for wholesale pricing.
                  </Text>

                  <Box padding="400" background="bg-surface-secondary" borderRadius="200">
                    <BlockStack gap="300">
                      <RadioButton
                        label="Default (Theme's Quantity Switcher)"
                        helpText="Uses your theme's default quantity input"
                        checked={quantityInputType === "default"}
                        id="default"
                        name="quantityInputType"
                        onChange={() => setQuantityInputType("default")}
                      />

                      <RadioButton
                        label="Dropdown"
                        helpText="Customers select quantity from a dropdown menu"
                        checked={quantityInputType === "dropdown"}
                        id="dropdown"
                        name="quantityInputType"
                        onChange={() => setQuantityInputType("dropdown")}
                      />

                      <RadioButton
                        label="Swatch"
                        helpText="Customers select quantity from clickable swatch buttons"
                        checked={quantityInputType === "swatch"}
                        id="swatch"
                        name="quantityInputType"
                        onChange={() => setQuantityInputType("swatch")}
                      />
                    </BlockStack>
                  </Box>

                  {quantityInputType === "dropdown" && (
                    <BlockStack gap="200">
                      <Text as="h3" variant="headingSm">
                        Dropdown Values
                      </Text>

                      <DndContext
                        collisionDetection={closestCenter}
                        onDragEnd={handleDragEnd}
                      >
                        <SortableContext
                          items={dropdownValues.map(item => item.id)}
                          strategy={verticalListSortingStrategy}
                        >
                          {dropdownValues.map((item, index) => (
                            <SortableDropdownItem
                              key={item.id}
                              id={item.id}
                              value={item.value}
                              index={index}
                              updateDropdownValue={updateDropdownValue}
                              removeDropdownValue={removeDropdownValue}
                            />
                          ))}
                        </SortableContext>
                      </DndContext>

                      <Button onClick={addDropdownValue}>
                        Add Dropdown Value
                      </Button>
                    </BlockStack>
                  )}

                  {quantityInputType === "swatch" && (
                    <BlockStack gap="200">
                      <Text as="h3" variant="headingSm">
                        Swatch Values
                      </Text>
                      <Text as="p" tone="subdued">
                        These will appear as clickable buttons for quantity selection.
                      </Text>

                      <DndContext
                        collisionDetection={closestCenter}
                        onDragEnd={handleSwatchDragEnd}
                      >
                        <SortableContext
                          items={swatchValues.map(item => item.id)}
                          strategy={verticalListSortingStrategy}
                        >
                          {swatchValues.map((item, index) => (
                            <SortableSwatchItem
                              key={item.id}
                              id={item.id}
                              value={item.value}
                              index={index}
                              updateSwatchValue={updateSwatchValue}
                              removeSwatchValue={removeSwatchValue}
                            />
                          ))}
                        </SortableContext>
                      </DndContext>

                      <Button onClick={addSwatchValue}>
                        Add Swatch Value
                      </Button>

                      {/* NEW: Swatch color settings */}
                      <BlockStack gap="200">
                        <Text as="h3" variant="headingSm">
                          Swatch Colors
                        </Text>
                        <Text as="p" tone="subdued">
                          Colors for the swatch buttons in their normal, hover, and selected (active) states.
                        </Text>

                        <InlineStack gap="300" wrap={true}>
                          <TextField
                            label="Background"
                            value={swatchColor}
                            onChange={setSwatchColor}
                            autoComplete="off"
                          />
                          <TextField
                            label="Border"
                            value={swatchBorderColor}
                            onChange={setSwatchBorderColor}
                            autoComplete="off"
                          />
                          <TextField
                            label="Text"
                            value={swatchTextColor}
                            onChange={setSwatchTextColor}
                            autoComplete="off"
                          />
                        </InlineStack>

                        <InlineStack gap="300" wrap={true}>
                          <TextField
                            label="Hover Background"
                            value={swatchHoverColor}
                            onChange={setSwatchHoverColor}
                            autoComplete="off"
                          />
                          <TextField
                            label="Hover Border"
                            value={swatchHoverBorderColor}
                            onChange={setSwatchHoverBorderColor}
                            autoComplete="off"
                          />
                        </InlineStack>

                        <InlineStack gap="300" wrap={true}>
                          <TextField
                            label="Active Background"
                            value={swatchActiveColor}
                            onChange={setSwatchActiveColor}
                            autoComplete="off"
                          />
                          <TextField
                            label="Active Border"
                            value={swatchActiveBorderColor}
                            onChange={setSwatchActiveBorderColor}
                            autoComplete="off"
                          />
                          <TextField
                            label="Active Text"
                            value={swatchActiveTextColor}
                            onChange={setSwatchActiveTextColor}
                            autoComplete="off"
                          />
                        </InlineStack>
                      </BlockStack>

                      {/* Preview of how swatch will look */}
                      <Box padding="400" background="bg-surface" borderRadius="200">
                        <Text as="h4" variant="headingXs">Preview:</Text>
                        <Box paddingBlockStart="300">
                          <SwatchColorPreview
                            colors={{
                              bg: swatchColor,
                              border: swatchBorderColor,
                              text: swatchTextColor,
                              hover: swatchHoverColor,
                              hoverBorder: swatchHoverBorderColor,
                              active: swatchActiveColor,
                              activeBorder: swatchActiveBorderColor,
                              activeText: swatchActiveTextColor,
                            }}
                          />
                        </Box>
                        <Box paddingBlockStart="400">
                          <Text as="p" tone="subdued" variant="bodySm">All values:</Text>
                          <InlineStack gap="200" wrap={true}>
                            {swatchValues.map((item, index) => (
                              item.value && (
                                <Box
                                  key={index}
                                  padding="200"
                                  background="bg-surface-secondary"
                                  borderRadius="200"
                                  borderWidth="1"
                                  borderColor="border"
                                >
                                  <Text as="span" variant="bodyMd">
                                    {item.value}
                                  </Text>
                                </Box>
                              )
                            ))}
                          </InlineStack>
                        </Box>
                      </Box>
                    </BlockStack>
                  )}
                </BlockStack>

                <BlockStack gap="300">
                  <Text as="h3" variant="headingMd">
                    Widget Styling
                  </Text>

                  <TextField
                    label="Widget Heading"
                    value={widgetHeading}
                    onChange={setWidgetHeading}
                    autoComplete="off"
                  />

                  <TextField
                    label="Background Color"
                    value={backgroundColor}
                    onChange={setBackgroundColor}
                    autoComplete="off"
                  />

                  <TextField
                    label="Border Color"
                    value={borderColor}
                    onChange={setBorderColor}
                    autoComplete="off"
                  />

                  <TextField
                    label="Text Color"
                    value={textColor}
                    onChange={setTextColor}
                    autoComplete="off"
                  />

                  <TextField
                    label="Highlight Color"
                    value={highlightColor}
                    onChange={setHighlightColor}
                    autoComplete="off"
                  />
                </BlockStack>

                <BlockStack gap="300">
                  <Text as="h3" variant="headingMd">
                    Pricing Slabs
                  </Text>

                  {slabs.map((slab, index) => (
                    <InlineStack gap="300" key={index}>
                      <TextField
                        label="Min Qty"
                        type="number"
                        value={slab.minQty}
                        onChange={(value) => updateSlab(index, "minQty", value)}
                        autoComplete="off"
                      />

                      <TextField
                        label="Max Qty"
                        type="number"
                        value={slab.maxQty}
                        onChange={(value) => updateSlab(index, "maxQty", value)}
                        autoComplete="off"
                      />

                      <TextField
                        label="Price"
                        type="number"
                        value={slab.price}
                        onChange={(value) => updateSlab(index, "price", value)}
                        autoComplete="off"
                      />
                    </InlineStack>
                  ))}

                  <Button onClick={addSlab}>
                    Add Slab
                  </Button>
                </BlockStack>

                <InlineStack gap="300">
                  <button
                    type="submit"
                    style={{
                      background: "black",
                      color: "white",
                      padding: "10px 16px",
                      borderRadius: "8px",
                      border: "none",
                      cursor: "pointer",
                    }}
                  >
                    Save Changes
                  </button>

                  <button
                    type="submit"
                    name="action"
                    value="delete"
                    onClick={(e) => {
                      if (!window.confirm("Delete this rule?")) {
                        e.preventDefault();
                      }
                    }}
                    style={{
                      background: "red",
                      color: "white",
                      padding: "10px 16px",
                      borderRadius: "8px",
                      border: "none",
                      cursor: "pointer",
                    }}
                  >
                    Delete Rule
                  </button>
                </InlineStack>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </Form>
    </Page>
  );
}