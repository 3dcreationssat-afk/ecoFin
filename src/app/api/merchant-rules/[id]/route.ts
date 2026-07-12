import {
  updateMerchantRule,
  setMerchantRuleActive,
  archiveMerchantRule,
} from "@/server/data/merchant-rules";
import { jsonError } from "@/server/data/errors";
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const body = await request.json();
    const { id } = await context.params;
    if (body.action === "archive") return Response.json(await archiveMerchantRule(id));
    if (body.action === "disable") return Response.json(await setMerchantRuleActive(id, false));
    if (body.action === "enable") return Response.json(await setMerchantRuleActive(id, true));
    return Response.json(
      await updateMerchantRule(id, body.rule ?? body, body.applyExisting === true),
    );
  } catch (error) {
    return jsonError(error);
  }
}
