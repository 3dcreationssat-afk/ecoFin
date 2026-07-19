import { NextResponse } from "next/server";
import { jsonError } from "@/server/data/errors";
import { createManualTransaction, getHousehold } from "@/server/data/repositories";
import { NextRequest } from "next/server";

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

export async function POST(request: NextRequest) {
  try {
    return NextResponse.json(await createManualTransaction(await request.json()), { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
