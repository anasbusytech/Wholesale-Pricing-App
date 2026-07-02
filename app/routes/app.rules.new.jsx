import { authenticate } from "../shopify.server";

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
} from "@shopify/polaris";

import {
  Form,
  useNavigate,
} from "react-router";

import { useState } from "react";
import { redirect } from "react-router";

import prisma from "../db.server";

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
  const dropdownValues =
    formData
      .get("dropdownValues")
      ?.split(",")
      .map(v => Number(v.trim()))
      .filter(Boolean) || [];
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

export default function CreateRulePage() {

  const navigate = useNavigate();

  const [name, setName] = useState("");

  const [enabled, setEnabled] =
    useState(true);

  const [quantityDropdownEnabled, setQuantityDropdownEnabled] = useState(false);

  const [dropdownValues, setDropdownValues] = useState("5,10,20,50");
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

    selected.forEach((product) => {

      product.variants.forEach((variant) => {

        formatted.push({
          productId: product.id,
          variantId: variant.id,
          title: `${product.title} - ${variant.title}`,
        });

      });

    });

    setProducts(formatted);

    setProducts(formatted);
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
                  value={dropdownValues}
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

                    <TextField
                      label="Dropdown Values"
                      helpText="Example: 5,10,20,50"
                      value={dropdownValues}
                      onChange={setDropdownValues}
                      autoComplete="off"
                    />

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