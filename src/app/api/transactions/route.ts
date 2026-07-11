import { NextResponse } from "next/server";
import { jsonError } from "@/server/data/errors";
import { getHousehold } from "@/server/data/repositories";

export async function GET() {
  try {
    const household = await getHousehold();
    return NextResponse.json({
      transactions: household.transactions,
      categories: household.categories,
      accounts: household.accounts,
    });
  } catch (error) {
    return jsonError(error);
  }
}
