import { bulkUpdateTransactions } from "@/server/data/transaction-bulk";
import { jsonError } from "@/server/data/errors";
export async function POST(request: Request) {
  try {
    return Response.json(await bulkUpdateTransactions(await request.json()));
  } catch (error) {
    return jsonError(error);
  }
}
