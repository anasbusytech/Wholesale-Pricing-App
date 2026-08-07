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
  SkeletonBodyText,
} from "@shopify/polaris";
import {
  Form,
  useLoaderData,
  useNavigate,
} from "react-router";
import { useState, useEffect } from "react";
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
              product {
                title
              }
              displayName
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
            // Use displayName or combine product and variant title
            const productTitle = node.product?.title || '';
            const variantTitle = node.title || '';
            productTitles[node.id] = variantTitle 
              ? `${productTitle} - ${variantTitle}`
              : productTitle || node.id;
          }
        });
      }
    } catch (error) {
      console.error('Error fetching product titles:', error);
    }
  }

  return { 
    rule,
    usedVariantIds,
    currentVariantIds: rule.products.map(p => p.variantId),
    productTitles,
  };
}

export async function action({ request, params }) {
  const formData = await request.formData();
  const widgetHeading = formData.get("widgetHeading");
  const backgroundColor = formData.get("backgroundColor");
  const borderColor = formData.get("borderColor");
  const textColor = formData.get("textColor");
  const highlightColor = formData.get("highlightColor");
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
  const quantityDropdownEnabled = formData.get("quantityDropdownEnabled") === "true";
  const dropdownValues = [
    ...new Set(
      formData
        .get("dropdownValues")
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
      quantityDropdown: dropdownValues,
      widgetConfig: {
        heading: widgetHeading,
        backgroundColor,
        borderColor,
        textColor,
        highlightColor,
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
        }
      }
    `, {
      variables: {
        automaticAppDiscount: {
          title: name,
          functionHandle: "wholesale-discount",
          startsAt: new Date(),
          metafields: [
            {
              namespace: "app",
              key: "function-configuration",
              type: "json",
              value: JSON.stringify({
                variantIds: products.map(p => p.variantId),
                slabs: slabs.map(slab => ({
                  minQty: Number(slab.minQty),
                  maxQty: slab.maxQty ? Number(slab.maxQty) : null,
                  discountPrice: Number(slab.price),
                })),
              }),
            },
          ],
        },
      },
    });

    const data = await response.json();
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

  if (existingRule?.discountId && !enabled) {
    const { admin } = await authenticate.admin(request);
    await admin.graphql(`
      mutation discountAutomaticDelete($id: ID!) {
        discountAutomaticDelete(id: $id) {
          deletedAutomaticDiscountId
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

  if (existingRule.discountId && enabled) {
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
  const { rule, usedVariantIds, currentVariantIds, productTitles } = useLoaderData();
  const [skippedCount, setSkippedCount] = useState(0);
  const [isLoadingTitles, setIsLoadingTitles] = useState(false);

  const [name, setName] = useState(rule.name);
  const [enabled, setEnabled] = useState(rule.enabled);
  const [quantityDropdownEnabled, setQuantityDropdownEnabled] = useState(
    rule.quantityInputEnabled
  );

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

  function removeProduct(variantId) {
    setProducts(products.filter(product => product.variantId !== variantId));
  }

  async function openProductPicker() {
    setSkippedCount(0);
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
                <input type="hidden" name="products" value={JSON.stringify(products)} />
                <input type="hidden" name="slabs" value={JSON.stringify(slabs)} />
                <input type="hidden" name="quantityDropdownEnabled" value={quantityDropdownEnabled} />
                <input type="hidden" name="dropdownValues" value={dropdownValues.map(item => item.value).join(",")} />

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

                  <Button submit={false} onClick={openProductPicker}>
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
                        <Text as="p">
                          {product.title}
                        </Text>
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
                  <Checkbox
                    label="Enable Quantity Dropdown"
                    checked={quantityDropdownEnabled}
                    onChange={setQuantityDropdownEnabled}
                  />

                  {quantityDropdownEnabled && (
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

                      <Button submit={false} onClick={addDropdownValue}>
                        Add Value
                      </Button>
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

                  <Button submit={false} onClick={addSlab}>
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
                    onClick={(e)=>{
                      if(!window.confirm("Delete this rule?")){
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