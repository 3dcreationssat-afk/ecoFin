import { NextResponse } from "next/server";
import { createAccount, getHousehold } from "@/server/data/repositories";
import { jsonError } from "@/server/data/errors";

export async function GET() {
  try {
    const household = await getHousehold();
    return NextResponse.json({ accounts: household.accounts, householdId: household.id });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const account = await createAccount(await request.json());
    return NextResponse.json({ account }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
