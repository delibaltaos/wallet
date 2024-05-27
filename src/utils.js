export const delay = async ms => new Promise(resolve => setTimeout(resolve, ms));
export const calculatePercentageDifference = (buyPrice, sellPrice) => ((sellPrice - buyPrice) / buyPrice) * 100;