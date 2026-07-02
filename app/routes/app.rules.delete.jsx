import { redirect } from "react-router";
import prisma from "../db.server";
import { authenticate } from "../shopify.server";

export async function action({ request }) {

  const { admin } =
    await authenticate.admin(request);

  const formData = await request.formData();

  const ruleId = formData.get("ruleId");

  const rule =
    await prisma.wholesaleRule.findUnique({
      where: {
        id: ruleId,
      },
    });

  if (rule?.shopifyDiscountId) {

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
        id: rule.shopifyDiscountId,
      },
    });

  }

  await prisma.wholesaleRule.delete({
    where: {
      id: ruleId,
    },
  });

  return redirect("/app/rules");
}