import { useLoaderData } from "react-router";
import prisma from "../../prisma/db.server";
import {
  Page,
  Layout,
  Card,
  Button,
  TextField,
  Checkbox,
  BlockStack,
  Text,
  List,
} from "@shopify/polaris";

import { useEffect, useState } from "react";
export async function loader() {
  const rules = await prisma.wholesaleRule.findMany({
    include: {
      slabs: true,
      products: true,
    },

    orderBy: {
      createdAt: "desc",
    },
  });

  return { rules };
}
export default function Index() {
  const { rules } = useLoaderData();

  const [name, setName] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [slabs, setSlabs] = useState([
    {
      minQty: "",
      maxQty: "",
      price: "",
    },
  ]);
   
  const [editingRuleId, setEditingRuleId] =
    useState(null);

  const [editName, setEditName] =
    useState("");

  const [editEnabled, setEditEnabled] =
    useState(true);


  async function openProductPicker() {
    const selection = await window.shopify.resourcePicker({
      type: "product",
      multiple: true,
    });

    if (!selection) return;

    setSelectedProducts(selection);
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
  function removeSlab(index) {
    const updated = [...slabs];

    updated.splice(index, 1);

    setSlabs(updated);
  }
  function updateSlab(index, field, value) {
    const updated = [...slabs];

    updated[index][field] = value;

    setSlabs(updated);
  }
  async function createRule() {
    const payload = {
      name,
      enabled,
      shopDomain: "muhammadreh-dev.myshopify.com",
      slabs,

      productIds: selectedProducts.map(
        (p) => p.id.split("/").pop()
      ),
    };

    const res = await fetch("/api/wholesale-rules", {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify(payload),
    });

    if (res.ok) {
      alert("Rule Created");

      setName("");

      setSelectedProducts([]);

      window.location.href = window.location.href;
    }
  }
  function startEdit(rule) {
    setEditingRuleId(rule.id);

    setEditName(rule.name);

    setEditEnabled(rule.enabled);
  }
  async function saveEdit() {
    await fetch("/api/wholesale-rules", {
      method: "PUT",

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        id: editingRuleId,
        name: editName,
        enabled: editEnabled,
      }),
    });

    setEditingRuleId(null);

    loadRules();
  }  
  return (
    <Page title="Wholesale Pricing Rules">
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="400">

              <Text variant="headingMd" as="h2">
                Create Wholesale Rule
              </Text>

              <TextField
                label="Rule Name"
                value={name}
                onChange={setName}
                autoComplete="off"
              />

              <Checkbox
                label="Enabled"
                checked={enabled}
                onChange={setEnabled}
              />

              <Button onClick={openProductPicker}>
                Select Products
              </Button>

              {selectedProducts.length > 0 && (
                <Card background="bg-surface-secondary">
                  <BlockStack gap="200">

                    <Text fontWeight="bold">
                      Selected Products
                    </Text>

                    <List>
                      {selectedProducts.map((product) => (
                        <List.Item key={product.id}>
                          {product.title}
                        </List.Item>
                      ))}
                    </List>

                  </BlockStack>
                </Card>
              )}

              <BlockStack gap="300">

                <Text variant="headingMd" as="h3">
                  Pricing Slabs
                </Text>

                {slabs.map((slab, index) => (
                  <Card key={index} background="bg-surface-secondary">

                    <BlockStack gap="200">

                      <TextField
                        label="Min Quantity"
                        type="number"
                        value={String(slab.minQty)}
                        onChange={(value) =>
                          updateSlab(index, "minQty", value)
                        }
                        autoComplete="off"
                      />

                      <TextField
                        label="Max Quantity"
                        type="number"
                        value={slab.maxQty?.toString() || ""}
                        onChange={(value) =>
                          updateSlab(index, "maxQty", value)
                        }
                        autoComplete="off"
                      />

                      <TextField
                        label="Price Per Unit"
                        type="number"
                        value={String(slab.price)}
                        onChange={(value) =>
                          updateSlab(index, "price", value)
                        }
                        autoComplete="off"
                      />

                    </BlockStack>
                  </Card>
                ))}

                <Button onClick={addSlab}>
                  Add Pricing Tier
                </Button>

              </BlockStack>
              <Text variant="headingMd" as="h3">
                Pricing Slabs
              </Text>

              {slabs.map((slab, index) => (
                <Card key={index}>
                  <BlockStack gap="200">

                    <TextField
                      label="Min Quantity"
                      type="number"
                      value={slab.minQty}
                      onChange={(value) =>
                        updateSlab(index, "minQty", value)
                      }
                      autoComplete="off"
                    />

                    <TextField
                      label="Max Quantity"
                      type="number"
                      value={slab.maxQty}
                      onChange={(value) =>
                        updateSlab(index, "maxQty", value)
                      }
                      autoComplete="off"
                    />

                    <TextField
                      label="Price"
                      type="number"
                      value={slab.price}
                      onChange={(value) =>
                        updateSlab(index, "price", value)
                      }
                      autoComplete="off"
                    />

                    <Button
                      tone="critical"
                      onClick={() => removeSlab(index)}
                    >
                      Remove Slab
                    </Button>

                  </BlockStack>
                </Card>
              ))}
              <Button onClick={addSlab}>
                Add Pricing Slab
              </Button>              
              <Button variant="primary" onClick={createRule}>
                Save Rule
              </Button>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="300">

              <Text variant="headingMd" as="h2">
                Existing Rules
              </Text>

              {rules.map((rule) => (
                <Card key={rule.id}>
                  <BlockStack gap="200">

                    {editingRuleId === rule.id ? (
                      <TextField
                        label="Rule Name"
                        value={editName}
                        onChange={setEditName}
                        autoComplete="off"
                      />
                    ) : (
                      <Text fontWeight="bold">
                        {rule.name}
                      </Text>
                    )}

                    {editingRuleId === rule.id ? (
                      <Checkbox
                        label="Enabled"
                        checked={editEnabled}
                        onChange={setEditEnabled}
                      />
                    ) : (
                      <Text>
                        Enabled: {rule.enabled ? "Yes" : "No"}
                      </Text>
                    )}

                    <Text>
                      Products Attached:
                    </Text>

                    <List>
                      {rule.products.map((p) => (
                        <List.Item key={p.id}>
                          Product ID: {p.productId}
                        </List.Item>
                      ))}
                    </List>
                    <Text fontWeight="bold">
                      Pricing Slabs:
                    </Text>

                    <List>
                      {rule.slabs.map((slab) => (
                        <List.Item key={slab.id}>
                          Qty {slab.minQty}
                          {slab.maxQty
                            ? ` - ${slab.maxQty}`
                            : "+"}
                          : Rs {slab.price}
                        </List.Item>
                      ))}
                    </List>  
                    <Button
                      onClick={() => startEdit(rule)}
                    >
                      Edit Rule
                    </Button>
                    {editingRuleId === rule.id && (
                      <Button
                        variant="primary"
                        onClick={saveEdit}
                      >
                        Save Changes
                      </Button>
                    )}                                        
                    <Button
                      tone="critical"
                      onClick={async () => {
                        await fetch("/api/wholesale-rules", {
                          method: "DELETE",
                          headers: {
                            "Content-Type": "application/json",
                          },
                          body: JSON.stringify({ id: rule.id }),
                        });

                        loadRules();
                      }}
                    >
                      Delete Rule
                    </Button>                                         
                  </BlockStack>                                     
                </Card>
            
              ))}
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}