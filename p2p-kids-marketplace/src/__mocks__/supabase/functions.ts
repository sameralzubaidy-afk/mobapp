import { fn } from 'jest-mock';

type FunctionInvokeResponse = {
  data: any;
  error: any;
};

const defaultInvokeResponse = (): FunctionInvokeResponse => ({
  data: {
    success: true,
  },
  error: null,
});

export const invokeFunction = fn(async () => defaultInvokeResponse());

export const createFunctionsMock = () => ({
  invoke: invokeFunction,
});

export const __setInvokeFunctionResponse = (response: FunctionInvokeResponse) => {
  invokeFunction.mockResolvedValue(response);
};

export const resetFunctionsMock = () => {
  invokeFunction.mockReset();
  invokeFunction.mockResolvedValue(defaultInvokeResponse());
};

resetFunctionsMock();
