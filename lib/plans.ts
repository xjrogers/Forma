export interface PlanConfig {
  id: string;
  name: string;
  price: number;
  yearlyPrice?: number;
  tokens: {
    daily?: number;
    monthly?: number;
    display: string;
  };
  deployments: {
    max: number;
    display: string;
  };
  features: string[];
  popular?: boolean;
}

export const PLAN_CONFIGS: Record<string, PlanConfig> = {
  free: {
    id: 'free',
    name: 'Free',
    price: 0,
    tokens: {
      daily: 200000, // 200K daily
      display: '200K daily'
    },
    deployments: {
      max: 0,
      display: 'No deployments'
    },
    features: [
      'Basic AI assistance',
      'Standard response time', 
      'Community support',
      'Basic templates',
      'Public projects only'
    ]
  },
  starter: {
    id: 'starter',
    name: 'Starter',
    price: 20,
    yearlyPrice: 17,
    tokens: {
      monthly: 12000000, // 12M monthly
      display: '12M monthly'
    },
    deployments: {
      max: 1,
      display: '1 deployment'
    },
    features: [
      'Advanced AI assistance',
      'Priority response time',
      'Email support',
      'Premium templates',
      'Private projects',
      'Custom integrations',
      'Advanced analytics'
    ],
    popular: true
  },
  business: {
    id: 'business',
    name: 'Business', 
    price: 50,
    yearlyPrice: 42.5,
    tokens: {
      monthly: 35000000, // 35M monthly
      display: '35M monthly'
    },
    deployments: {
      max: 3,
      display: '3 deployments'
    },
    features: [
      'Enterprise AI assistance',
      'Instant response time',
      'Priority support',
      'All premium templates',
      'Unlimited private projects',
      'Advanced integrations',
      'Custom AI models',
      'Team collaboration',
      'Advanced security'
    ]
  }
};

export const getPlanConfig = (planId: string): PlanConfig => {
  return PLAN_CONFIGS[planId] || PLAN_CONFIGS.free;
};

export const getDeploymentLimit = (planId: string): number => {
  return getPlanConfig(planId).deployments.max;
};

export const getTokenLimit = (planId: string): number => {
  const config = getPlanConfig(planId);
  return config.tokens.monthly || config.tokens.daily || 0;
}; 