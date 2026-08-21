import { useQuery } from '@tanstack/react-query';
import { pricingApi, productsApi } from '../../lib/api';
import { pricingKeys, productKeys } from '../../lib/queryKeys';
import type { CustomerGroup, CustomerWithGroup, PriceList, PriceRule } from '../../types/pricing';

export function usePricingGroups() {
  return useQuery<CustomerGroup[]>({
    queryKey: pricingKeys.groups(),
    queryFn: () => pricingApi.getGroups().then((r) => r.data),
  });
}

export function usePricingLists() {
  return useQuery<PriceList[]>({
    queryKey: pricingKeys.lists(),
    queryFn: () => pricingApi.getLists().then((r) => r.data),
  });
}

export function useCustomersWithGroups() {
  return useQuery<CustomerWithGroup[]>({
    queryKey: pricingKeys.customersWithGroups(),
    queryFn: () => pricingApi.getCustomersWithGroups().then((r) => r.data),
  });
}

export function usePricingProductGroups() {
  return useQuery<string[]>({
    queryKey: productKeys.groups(),
    queryFn: () => productsApi.getGroups().then((r) => r.data),
  });
}

export function usePricingRules(listId: number | null) {
  return useQuery<PriceRule[]>({
    queryKey: pricingKeys.rules(listId ?? 0),
    queryFn: () => pricingApi.getRules(listId!).then((r) => r.data),
    enabled: listId != null,
  });
}

export function usePricingCatalogLoading() {
  const groups = usePricingGroups();
  const lists = usePricingLists();
  const customers = useCustomersWithGroups();
  const productGroups = usePricingProductGroups();
  return (
    groups.isLoading || lists.isLoading || customers.isLoading || productGroups.isLoading
  );
}
