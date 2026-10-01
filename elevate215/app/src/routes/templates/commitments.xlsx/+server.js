import { buildCommitmentsTemplate, xlsxResponse } from '$lib/server/templates.js';

/** Empty grant commitments file with just the header row. */
export const GET = () => xlsxResponse(buildCommitmentsTemplate(), 'commitments-template.xlsx');
