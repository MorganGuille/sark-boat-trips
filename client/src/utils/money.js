// 40 becomes £40, 12.5 becomes £12.50 (whole pounds drop the pence)
export const formatPounds = (pounds) =>
    `£${Number.isInteger(pounds) ? pounds : Number(pounds).toFixed(2)}`
