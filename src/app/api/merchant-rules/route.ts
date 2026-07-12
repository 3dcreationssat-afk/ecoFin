import {
  createMerchantRule,
  listMerchantRules,
  previewMerchantRule,
} from "@/server/data/merchant-rules";
import { jsonError } from "@/server/data/errors";
export async function GET() {
  try {
    return Response.json({ rules: await listMerchantRules() });
  } catch (error) {
    return jsonError(error);
  }
}
export async function POST(request: Request) {
  try {
    const body = await request.json();
    return Response.json(await createMerchantRule(body.rule ?? body, body.applyExisting === true), {
      status: 201,
    });
  } catch (error) {
    return jsonError(error);
  }
}
export async function PUT(request: Request) {
  try {
    return Response.json(await previewMerchantRule(await request.json()));
  } catch (error) {
    return jsonError(error);
  }
}
