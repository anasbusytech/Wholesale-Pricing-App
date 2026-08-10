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
  useNavigate,
  useLoaderData,
} from "react-router";

import { useState } from "react";
import { redirect } from "react-router";

import prisma from "../db.server";

export async function loader() {
  const rules = await prisma.wholesaleRule.findMany({
    include: {
      products: true,
    },
  });

  return {
    usedVariantIds: rules.flatMap(rule =>
      rule.products.map(product => product.variantId)
    ),
  };
}

export async function action({ request }) {
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

  const name = formData.get("name");
  const enabled = formData.get("enabled") === "true";
  
  // Get quantity input type: 'dropdown', 'swatch', or 'default'
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
  
  // Get swatch values
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

  // CREATE DATABASE RULE
  const createdRule = await prisma.wholesaleRule.create({
    data: {
      shopDomain: "demo-store.myshopify.com",
      name,
      enabled,
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
      quantityInputEnabled: quantityDropdownEnabled,
      quantitySwatchEnabled: quantitySwatchEnabled,
      quantityDropdown: dropdownValues,
      quantitySwatch: swatchValues,
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

  // CREATE SHOPIFY DISCOUNT
  if (enabled) {
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
        id: createdRule.id,
      },
      data: {
        discountId,
      },
    });
  }
  return redirect("/app/rules");
}

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

export default function CreateRulePage() {
  const navigate = useNavigate();
  const { usedVariantIds } = useLoaderData();
  const [skippedCount, setSkippedCount] = useState(0);
  const [name, setName] = useState("");
  const [enabled, setEnabled] = useState(true);
  
  // Quantity input type: 'default', 'dropdown', 'swatch'
  const [quantityInputType, setQuantityInputType] = useState("default");

  const [dropdownValues, setDropdownValues] = useState([
    { id: crypto.randomUUID(), value: "5" },
    { id: crypto.randomUUID(), value: "10" },
    { id: crypto.randomUUID(), value: "20" },
    { id: crypto.randomUUID(), value: "50" },
  ]);

  const [swatchValues, setSwatchValues] = useState([
    { id: crypto.randomUUID(), value: "5" },
    { id: crypto.randomUUID(), value: "10" },
    { id: crypto.randomUUID(), value: "20" },
    { id: crypto.randomUUID(), value: "50" },
  ]);

  const [widgetHeading, setWidgetHeading] = useState("Wholesale Pricing");
  const [backgroundColor, setBackgroundColor] = useState("#ffffff");
  const [borderColor, setBorderColor] = useState("#d9d9d9");
  const [textColor, setTextColor] = useState("#000000");
  const [highlightColor, setHighlightColor] = useState("#d1fadf");

  // NEW: swatch color state - defaults match the widget's own CSS
  // fallback values, so an unedited rule looks identical to before.
  const [swatchColor, setSwatchColor] = useState("#ffffff");
  const [swatchBorderColor, setSwatchBorderColor] = useState("#d9d9d9");
  const [swatchTextColor, setSwatchTextColor] = useState("#000000");
  const [swatchHoverColor, setSwatchHoverColor] = useState("#f5f5f5");
  const [swatchHoverBorderColor, setSwatchHoverBorderColor] = useState("#999999");
  const [swatchActiveColor, setSwatchActiveColor] = useState("#000000");
  const [swatchActiveBorderColor, setSwatchActiveBorderColor] = useState("#000000");
  const [swatchActiveTextColor, setSwatchActiveTextColor] = useState("#ffffff");

  const [products, setProducts] = useState([]);
  const [slabs, setSlabs] = useState([
    {
      minQty: "",
      maxQty: "",
      price: "",
    },
  ]);

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
        if (usedVariantIds.includes(variant.id)) {
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
      title="Create Wholesale Rule"
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
                  Save Rule
                </button>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </Form>
    </Page>
  );
}