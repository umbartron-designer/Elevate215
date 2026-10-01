import { buildForecastTemplate, xlsxResponse } from '$lib/server/templates.js';

/** Empty forecast workbook with just the two header rows. */
export const GET = () => xlsxResponse(buildForecastTemplate(), 'forecast-template.xlsx');
