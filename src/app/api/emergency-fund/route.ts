import { jsonError } from "@/server/data/errors";
import {
  getEmergencyFundConfiguration,
  updateEmergencyFundConfiguration,
} from "@/server/data/emergency-fund";

export async function GET() {
  try {
    return Response.json(await getEmergencyFundConfiguration());
  } catch (error) {
    return jsonError(error);
  }
}

export async function PUT(request: Request) {
  try {
    return Response.json(await updateEmergencyFundConfiguration(await request.json()));
  } catch (error) {
    return jsonError(error);
  }
}
