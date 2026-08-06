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

  const rules =
    await prisma.wholesaleRule.findMany({
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
  const widgetHeading =
  formData.get("widgetHeading");

  const backgroundColor =
    formData.get("backgroundColor");

  const borderColor =
    formData.get("borderColor");

  const textColor =
    formData.get("textColor");

  const highlightColor =
    formData.get("highlightColor");
  const name = formData.get("name");

  const enabled =
    formData.get("enabled") === "true";

  const quantityDropdownEnabled =
    formData.get("quantityDropdownEnabled") === "true";
  const dropdownValues = [
    ...new Set(
      formData
        .get("dropdownValues")
        ?.split(",")
        .map(v => Number(v.trim()))
        .filter(Boolean)
    ),
  ];
  const products = JSON.parse(
    formData.get("products") || "[]"
  );

  const slabs = JSON.parse(
    formData.get("slabs") || "[]"
  );

  // CREATE DATABASE RULE

  const createdRule =
    await prisma.wholesaleRule.create({
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
        },
        quantityInputEnabled: quantityDropdownEnabled,
        quantityDropdown: dropdownValues,
        products: {
          create: products.map((variant) => ({
            productId: variant.productId,
            variantId: variant.variantId,
          })),
        },

        slabs: {
          create: slabs.map((slab) => ({
            minQty: Number(slab.minQty),

            maxQty: slab.maxQty
              ? Number(slab.maxQty)
              : null,

            price: Number(slab.price),
          })),
        },
      },
    });

  // CREATE SHOPIFY DISCOUNT
  if (enabled) {

    const { admin } =
      await authenticate.admin(request);

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
                variantIds: products.map(
                  (product) => product.variantId
                ),

                slabs: slabs.map((slab) => ({
                  minQty: Number(slab.minQty),
                  maxQty: slab.maxQty
                    ? Number(slab.maxQty)
                    : null,
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

    const discountId =
      data.data.discountAutomaticAppCreate
        .automaticAppDiscount.discountId;

    // SAVE SHOPIFY DISCOUNT ID

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
    <div
      ref={setNodeRef}
      style={style}
    >
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
          onChange={(val) =>
            updateDropdownValue(index, val)
          }
        />
      </div>

      <Button
        destructive
        onClick={() => removeDropdownValue(index)}
      >
        Delete
      </Button>
    </div>
  );
}
export default function CreateRulePage() {

  const navigate = useNavigate();
  const { usedVariantIds } =
    useLoaderData();
  const [skippedCount,
    setSkippedCount] =
  useState(0);    
  const [name, setName] = useState("");

  const [enabled, setEnabled] =
    useState(true);

  const [quantityDropdownEnabled, setQuantityDropdownEnabled] = useState(false);

  const [dropdownValues, setDropdownValues] = useState([
    { id: crypto.randomUUID(), value: "5" },
    { id: crypto.randomUUID(), value: "10" },
    { id: crypto.randomUUID(), value: "20" },
    { id: crypto.randomUUID(), value: "50" },
  ]);
  const [widgetHeading, setWidgetHeading] =
    useState("Wholesale Pricing");

  const [backgroundColor, setBackgroundColor] =
    useState("#ffffff");

  const [borderColor, setBorderColor] =
    useState("#d9d9d9");

  const [textColor, setTextColor] =
    useState("#000000");

  const [highlightColor, setHighlightColor] =
    useState("#d1fadf");
  const [products, setProducts] =
    useState([]);

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
function handleDragEnd(event) {
  const { active, over } = event;

  if (!over || active.id === over.id) return;

  const oldIndex =
    dropdownValues.findIndex(
      item => item.id === active.id
    );

  const newIndex =
    dropdownValues.findIndex(
      item => item.id === over.id
    );

  setDropdownValues(
    arrayMove(
      dropdownValues,
      oldIndex,
      newIndex
    )
  );
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

    setDropdownValues(

      dropdownValues.filter(
        (_, i) => i !== index
      )

    );

  }
  async function openProductPicker() {

    const selected =
      await shopify.resourcePicker({
        type: "product",
        multiple: true,
        filter: {
          variants: true,
        },        
      });

    if (!selected) return;

      const formatted = [];

      let skipped = 0;

      selected.forEach((product) => {

        product.variants.forEach((variant) => {

          if (
            usedVariantIds.includes(variant.id)
          ) {

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

      setProducts([
        ...products,
        ...formatted,
      ]);
  }

  return (
    <Page
      title="Create Wholesale Rule"

      backAction={{
        content: "Rules",

        onAction: () =>
          navigate("/app/rules"),
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

                <input
                  type="hidden"
                  name="name"
                  value={name}
                />

                <input
                  type="hidden"
                  name="enabled"
                  value={enabled}
                />
                <input
                  type="hidden"
                  name="widgetHeading"
                  value={widgetHeading}
                />

                <input
                  type="hidden"
                  name="backgroundColor"
                  value={backgroundColor}
                />

                <input
                  type="hidden"
                  name="borderColor"
                  value={borderColor}
                />

                <input
                  type="hidden"
                  name="textColor"
                  value={textColor}
                />

                <input
                  type="hidden"
                  name="highlightColor"
                  value={highlightColor}
                />
                <input
                  type="hidden"
                  name="products"
                  value={JSON.stringify(products)}
                />
                <input
                  type="hidden"
                  name="slabs"
                  value={JSON.stringify(slabs)}
                />

                <input
                  type="hidden"
                  name="quantityDropdownEnabled"
                  value={quantityDropdownEnabled}
                />
                <input
                  type="hidden"
                  name="dropdownValues"
                  value={dropdownValues
                  .map(item => item.value)
                  .join(",")}
                />
                <Checkbox
                  label="Enable Rule"

                  checked={enabled}

                  onChange={setEnabled}
                />

                <BlockStack gap="300">

                  <Text
                    as="h3"
                    variant="headingMd"
                  >
                    Products
                  </Text>
                  {skippedCount > 0 && (

                    <Banner
                      tone="warning"
                    >

                      {skippedCount}
                      {" "}
                      variant(s) were skipped because they are already used in another wholesale rule.

                    </Banner>

                  )}
                  <Button
                    onClick={openProductPicker}
                  >
                    Select Products
                  </Button>

                  {products.map((product) => (

                    <Card key={product.variantId}>
                      <Text as="p">
                        {product.title}
                      </Text>
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

                      <Text
                        as="h3"
                        variant="headingSm"
                      >
                        Dropdown Values
                      </Text>

                      <DndContext
                        collisionDetection={closestCenter}
                        onDragEnd={handleDragEnd}
                      >
                        <SortableContext
                          items={dropdownValues.map(
                            (value, index) =>
                              `${value}-${index}`
                          )}
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

                      <Button
                        onClick={addDropdownValue}
                      >
                        Add Value
                      </Button>

                    </BlockStack>

                  )}

                </BlockStack>
                <BlockStack gap="300">

                  <Text
                    as="h3"
                    variant="headingMd"
                  >
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

                  <h3>
                    Pricing Slabs
                  </h3>

                  {slabs.map((slab, index) => (

                    <InlineStack
                      gap="300"
                      key={index}
                    >

                      <TextField
                        label="Min Qty"

                        type="number"

                        value={slab.minQty}

                        onChange={(value) =>
                          updateSlab(
                            index,
                            "minQty",
                            value
                          )
                        }

                        autoComplete="off"
                      />

                      <TextField
                        label="Max Qty"

                        type="number"

                        value={slab.maxQty}

                        onChange={(value) =>
                          updateSlab(
                            index,
                            "maxQty",
                            value
                          )
                        }

                        autoComplete="off"
                      />

                      <TextField
                        label="Price"

                        type="number"

                        value={slab.price}

                        onChange={(value) =>
                          updateSlab(
                            index,
                            "price",
                            value
                          )
                        }

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