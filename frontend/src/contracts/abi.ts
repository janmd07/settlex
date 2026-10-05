export const SETTLEX_ESCROW_ABI = [
  {
    type: "function",
    name: "approveAndRelease",
    inputs: [{ name: "dealId", type: "uint256", internalType: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "cancelDeal",
    inputs: [{ name: "dealId", type: "uint256", internalType: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "claimExpiredRefund",
    inputs: [{ name: "dealId", type: "uint256", internalType: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "createAndFundDeal",
    inputs: [
      { name: "seller", type: "address", internalType: "address" },
      { name: "amount", type: "uint256", internalType: "uint256" },
      { name: "deadline", type: "uint256", internalType: "uint256" },
      { name: "arbiter", type: "address", internalType: "address" },
      { name: "metadataUri", type: "string", internalType: "string" }
    ],
    outputs: [{ name: "dealId", type: "uint256", internalType: "uint256" }],
    stateMutability: "payable"
  },
  {
    type: "function",
    name: "createDeal",
    inputs: [
      { name: "seller", type: "address", internalType: "address" },
      { name: "amount", type: "uint256", internalType: "uint256" },
      { name: "deadline", type: "uint256", internalType: "uint256" },
      { name: "arbiter", type: "address", internalType: "address" },
      { name: "metadataUri", type: "string", internalType: "string" }
    ],
    outputs: [{ name: "dealId", type: "uint256", internalType: "uint256" }],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "deals",
    inputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    outputs: [
      { name: "dealId", type: "uint256", internalType: "uint256" },
      { name: "buyer", type: "address", internalType: "address" },
      { name: "seller", type: "address", internalType: "address" },
      { name: "arbiter", type: "address", internalType: "address" },
      { name: "amount", type: "uint256", internalType: "uint256" },
      { name: "deadline", type: "uint256", internalType: "uint256" },
      { name: "state", type: "uint8", internalType: "enum SettleXEscrow.DealState" },
      { name: "createdAt", type: "uint256", internalType: "uint256" },
      { name: "fundedAt", type: "uint256", internalType: "uint256" },
      { name: "settledAt", type: "uint256", internalType: "uint256" },
      { name: "metadataUri", type: "string", internalType: "string" }
    ],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "fundDeal",
    inputs: [{ name: "dealId", type: "uint256", internalType: "uint256" }],
    outputs: [],
    stateMutability: "payable"
  },
  {
    type: "function",
    name: "getDeal",
    inputs: [{ name: "dealId", type: "uint256", internalType: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        internalType: "struct SettleXEscrow.Deal",
        components: [
          { name: "dealId", type: "uint256", internalType: "uint256" },
          { name: "buyer", type: "address", internalType: "address" },
          { name: "seller", type: "address", internalType: "address" },
          { name: "arbiter", type: "address", internalType: "address" },
          { name: "amount", type: "uint256", internalType: "uint256" },
          { name: "deadline", type: "uint256", internalType: "uint256" },
          { name: "state", type: "uint8", internalType: "enum SettleXEscrow.DealState" },
          { name: "createdAt", type: "uint256", internalType: "uint256" },
          { name: "fundedAt", type: "uint256", internalType: "uint256" },
          { name: "settledAt", type: "uint256", internalType: "uint256" },
          { name: "metadataUri", type: "string", internalType: "string" }
        ]
      }
    ],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "getUserDealCount",
    inputs: [{ name: "user", type: "address", internalType: "address" }],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "getUserDeals",
    inputs: [{ name: "user", type: "address", internalType: "address" }],
    outputs: [{ name: "", type: "uint256[]", internalType: "uint256[]" }],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "nextDealId",
    inputs: [],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "raiseDispute",
    inputs: [
      { name: "dealId", type: "uint256", internalType: "uint256" },
      { name: "reason", type: "string", internalType: "string" }
    ],
    outputs: [],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "refundBuyer",
    inputs: [{ name: "dealId", type: "uint256", internalType: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "resolveDispute",
    inputs: [
      { name: "dealId", type: "uint256", internalType: "uint256" },
      { name: "buyerAmount", type: "uint256", internalType: "uint256" },
      { name: "sellerAmount", type: "uint256", internalType: "uint256" }
    ],
    outputs: [],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "submitWork",
    inputs: [
      { name: "dealId", type: "uint256", internalType: "uint256" },
      { name: "submissionUri", type: "string", internalType: "string" }
    ],
    outputs: [],
    stateMutability: "nonpayable"
  },
  {
    type: "event",
    name: "DealCancelled",
    inputs: [
      { name: "dealId", type: "uint256", indexed: true, internalType: "uint256" },
      { name: "cancelledBy", type: "address", indexed: true, internalType: "address" },
      { name: "cancelledAt", type: "uint256", indexed: false, internalType: "uint256" }
    ],
    anonymous: false
  },
  {
    type: "event",
    name: "DealCreated",
    inputs: [
      { name: "dealId", type: "uint256", indexed: true, internalType: "uint256" },
      { name: "buyer", type: "address", indexed: true, internalType: "address" },
      { name: "seller", type: "address", indexed: true, internalType: "address" },
      { name: "amount", type: "uint256", indexed: false, internalType: "uint256" },
      { name: "deadline", type: "uint256", indexed: false, internalType: "uint256" },
      { name: "arbiter", type: "address", indexed: false, internalType: "address" },
      { name: "metadataUri", type: "string", indexed: false, internalType: "string" }
    ],
    anonymous: false
  },
  {
    type: "event",
    name: "DealFunded",
    inputs: [
      { name: "dealId", type: "uint256", indexed: true, internalType: "uint256" },
      { name: "buyer", type: "address", indexed: true, internalType: "address" },
      { name: "amount", type: "uint256", indexed: false, internalType: "uint256" },
      { name: "fundedAt", type: "uint256", indexed: false, internalType: "uint256" }
    ],
    anonymous: false
  },
  {
    type: "event",
    name: "DealRefunded",
    inputs: [
      { name: "dealId", type: "uint256", indexed: true, internalType: "uint256" },
      { name: "buyer", type: "address", indexed: true, internalType: "address" },
      { name: "amount", type: "uint256", indexed: false, internalType: "uint256" },
      { name: "refundedAt", type: "uint256", indexed: false, internalType: "uint256" }
    ],
    anonymous: false
  },
  {
    type: "event",
    name: "DealSettled",
    inputs: [
      { name: "dealId", type: "uint256", indexed: true, internalType: "uint256" },
      { name: "seller", type: "address", indexed: true, internalType: "address" },
      { name: "amount", type: "uint256", indexed: false, internalType: "uint256" },
      { name: "settledAt", type: "uint256", indexed: false, internalType: "uint256" }
    ],
    anonymous: false
  },
  {
    type: "event",
    name: "DisputeRaised",
    inputs: [
      { name: "dealId", type: "uint256", indexed: true, internalType: "uint256" },
      { name: "raisedBy", type: "address", indexed: true, internalType: "address" },
      { name: "reason", type: "string", indexed: false, internalType: "string" }
    ],
    anonymous: false
  },
  {
    type: "event",
    name: "DisputeResolved",
    inputs: [
      { name: "dealId", type: "uint256", indexed: true, internalType: "uint256" },
      { name: "arbiter", type: "address", indexed: true, internalType: "address" },
      { name: "buyerAmount", type: "uint256", indexed: false, internalType: "uint256" },
      { name: "sellerAmount", type: "uint256", indexed: false, internalType: "uint256" }
    ],
    anonymous: false
  },
  {
    type: "event",
    name: "WorkSubmitted",
    inputs: [
      { name: "dealId", type: "uint256", indexed: true, internalType: "uint256" },
      { name: "seller", type: "address", indexed: true, internalType: "address" },
      { name: "submissionUri", type: "string", indexed: false, internalType: "string" },
      { name: "submittedAt", type: "uint256", indexed: false, internalType: "uint256" }
    ],
    anonymous: false
  },
  {
    type: "error",
    name: "BuyerCannotBeSeller",
    inputs: []
  },
  {
    type: "error",
    name: "DeadlineNotPassed",
    inputs: []
  },
  {
    type: "error",
    name: "DeadlinePassed",
    inputs: []
  },
  {
    type: "error",
    name: "DealDoesNotExist",
    inputs: [{ name: "dealId", type: "uint256", internalType: "uint256" }]
  },
  {
    type: "error",
    name: "DirectDepositNotAllowed",
    inputs: []
  },
  {
    type: "error",
    name: "IncorrectPayment",
    inputs: [
      { name: "expected", type: "uint256", internalType: "uint256" },
      { name: "actual", type: "uint256", internalType: "uint256" }
    ]
  },
  {
    type: "error",
    name: "InvalidArbiter",
    inputs: []
  },
  {
    type: "error",
    name: "InvalidDeadline",
    inputs: [
      { name: "provided", type: "uint256", internalType: "uint256" },
      { name: "current", type: "uint256", internalType: "uint256" }
    ]
  },
  {
    type: "error",
    name: "InvalidDealState",
    inputs: [
      { name: "dealId", type: "uint256", internalType: "uint256" },
      { name: "currentState", type: "uint8", internalType: "enum SettleXEscrow.DealState" }
    ]
  },
  {
    type: "error",
    name: "InvalidSplit",
    inputs: [
      { name: "totalGiven", type: "uint256", internalType: "uint256" },
      { name: "requiredAmount", type: "uint256", internalType: "uint256" }
    ]
  },
  {
    type: "error",
    name: "ReentrancyGuardReentrantCall",
    inputs: []
  },
  {
    type: "error",
    name: "TransferFailed",
    inputs: [
      { name: "recipient", type: "address", internalType: "address" },
      { name: "amount", type: "uint256", internalType: "uint256" }
    ]
  },
  {
    type: "error",
    name: "Unauthorized",
    inputs: [
      { name: "caller", type: "address", internalType: "address" },
      { name: "expectedRole", type: "string", internalType: "string" }
    ]
  },
  {
    type: "error",
    name: "ZeroAddress",
    inputs: [{ name: "parameterName", type: "string", internalType: "string" }]
  },
  {
    type: "error",
    name: "ZeroAmount",
    inputs: []
  }
] as const;
