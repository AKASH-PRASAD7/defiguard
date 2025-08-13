import Web3 from 'web3';

// Network configurations
export const NETWORKS = {
    1: {
        name: 'Ethereum Mainnet',
        chainId: '0x1',
        rpcUrl: 'https://mainnet.infura.io/v3/',
        blockExplorer: 'https://etherscan.io'
    },
    5: {
        name: 'Goerli Testnet',
        chainId: '0x5',
        rpcUrl: 'https://goerli.infura.io/v3/',
        blockExplorer: 'https://goerli.etherscan.io'
    },
    11155111: {
        name: 'Sepolia Testnet',
        chainId: '0xaa36a7',
        rpcUrl: 'https://sepolia.infura.io/v3/',
        blockExplorer: 'https://sepolia.etherscan.io'
    },
    1337: {
        name: 'Local Development',
        chainId: '0x539',
        rpcUrl: 'http://127.0.0.1:8545',
        blockExplorer: 'http://localhost'
    }
};

// Check if MetaMask is installed
export const isMetaMaskInstalled = () => {
    return typeof window !== 'undefined' && typeof window.ethereum !== 'undefined';
};

// Get Web3 instance
export const getWeb3Instance = () => {
    if (isMetaMaskInstalled()) {
        return new Web3(window.ethereum);
    }
    throw new Error('MetaMask is not installed');
};

// Connect to wallet
export const connectWallet = async () => {
    try {
        if (!isMetaMaskInstalled()) {
            throw new Error('MetaMask is not installed. Please install MetaMask to use this wallet.');
        }

        const web3 = getWeb3Instance();
        
        // Request account access
        const accounts = await window.ethereum.request({
            method: 'eth_requestAccounts'
        });

        if (accounts.length === 0) {
            throw new Error('No accounts found');
        }

        return {
            web3,
            account: accounts[0],
            accounts
        };
    } catch (error) {
        throw new Error(`Failed to connect wallet: ${error.message}`);
    }
};

// Get account balance
export const getBalance = async (web3, address) => {
    try {
        const balanceWei = await web3.eth.getBalance(address);
        const balanceEth = web3.utils.fromWei(balanceWei, 'ether');
        return parseFloat(balanceEth).toFixed(4);
    } catch (error) {
        throw new Error(`Failed to get balance: ${error.message}`);
    }
};

// Get network information
export const getNetworkInfo = async (web3) => {
    try {
        const networkId = await web3.eth.net.getId();
        const network = NETWORKS[networkId];
        
        return {
            networkId,
            networkName: network ? network.name : `Network ID: ${networkId}`,
            network
        };
    } catch (error) {
        throw new Error(`Failed to get network info: ${error.message}`);
    }
};

// Validate Ethereum address
export const isValidAddress = (address) => {
    const web3 = getWeb3Instance();
    return web3.utils.isAddress(address);
};

// Convert ETH to Wei
export const ethToWei = (ethAmount) => {
    const web3 = getWeb3Instance();
    return web3.utils.toWei(ethAmount.toString(), 'ether');
};

// Convert Wei to ETH
export const weiToEth = (weiAmount) => {
    const web3 = getWeb3Instance();
    return web3.utils.fromWei(weiAmount.toString(), 'ether');
};

// Convert GWEI to Wei
export const gweiToWei = (gweiAmount) => {
    const web3 = getWeb3Instance();
    return web3.utils.toWei(gweiAmount.toString(), 'gwei');
};

// Estimate gas for transaction
export const estimateGas = async (web3, transactionObject) => {
    try {
        const gasEstimate = await web3.eth.estimateGas(transactionObject);
        return gasEstimate;
    } catch (error) {
        throw new Error(`Failed to estimate gas: ${error.message}`);
    }
};

// Send ETH transaction
export const sendTransaction = async (web3, transactionParams) => {
    try {
        const { from, to, amount, gasPrice = '20' } = transactionParams;

        // Validate parameters
        if (!from || !to || !amount) {
            throw new Error('Missing required transaction parameters');
        }

        if (!isValidAddress(to)) {
            throw new Error('Invalid recipient address');
        }

        const amountWei = ethToWei(amount);
        const gasPriceWei = gweiToWei(gasPrice);

        // Prepare transaction object
        const txObject = {
            from,
            to,
            value: amountWei
        };

        // Estimate gas
        const gasLimit = await estimateGas(web3, txObject);

        // Add gas parameters to transaction
        txObject.gas = gasLimit;
        txObject.gasPrice = gasPriceWei;

        // Send transaction
        const receipt = await web3.eth.sendTransaction(txObject);
        
        return {
            transactionHash: receipt.transactionHash,
            blockNumber: receipt.blockNumber,
            gasUsed: receipt.gasUsed,
            status: receipt.status
        };
    } catch (error) {
        throw new Error(`Transaction failed: ${error.message}`);
    }
};

// Get transaction details
export const getTransaction = async (web3, txHash) => {
    try {
        const transaction = await web3.eth.getTransaction(txHash);
        const receipt = await web3.eth.getTransactionReceipt(txHash);
        
        return {
            ...transaction,
            receipt,
            status: receipt ? receipt.status : 'pending'
        };
    } catch (error) {
        throw new Error(`Failed to get transaction: ${error.message}`);
    }
};

// Get transaction history (simplified version)
export const getTransactionHistory = async (web3, address, maxBlocks = 100, maxTransactions = 10) => {
    try {
        const latestBlock = await web3.eth.getBlockNumber();
        const transactions = [];
        
        const blocksToCheck = Math.min(maxBlocks, latestBlock);
        
        for (let i = 0; i < blocksToCheck && transactions.length < maxTransactions; i++) {
            const blockNumber = latestBlock - i;
            const block = await web3.eth.getBlock(blockNumber, true);
            
            if (block && block.transactions) {
                block.transactions.forEach(tx => {
                    if ((tx.from && tx.from.toLowerCase() === address.toLowerCase()) || 
                        (tx.to && tx.to.toLowerCase() === address.toLowerCase())) {
                        transactions.push({
                            hash: tx.hash,
                            from: tx.from,
                            to: tx.to,
                            value: weiToEth(tx.value),
                            blockNumber: tx.blockNumber,
                            timestamp: new Date().toLocaleString(), // In real app, use block timestamp
                            type: tx.from.toLowerCase() === address.toLowerCase() ? 'sent' : 'received',
                            gasPrice: tx.gasPrice,
                            gas: tx.gas
                        });
                    }
                });
            }
        }
        
        return transactions.slice(0, maxTransactions);
    } catch (error) {
        console.error('Error getting transaction history:', error);
        return [];
    }
};

// Format address for display (truncate)
export const formatAddress = (address, startChars = 6, endChars = 4) => {
    if (!address) return '';
    if (address.length <= startChars + endChars) return address;
    return `${address.substring(0, startChars)}...${address.substring(address.length - endChars)}`;
};

// Format balance for display
export const formatBalance = (balance, decimals = 4) => {
    const num = parseFloat(balance);
    if (isNaN(num)) return '0.0000';
    return num.toFixed(decimals);
};

// Get gas price recommendation
export const getGasPriceRecommendation = async (web3) => {
    try {
        const gasPrice = await web3.eth.getGasPrice();
        const gasPriceGwei = web3.utils.fromWei(gasPrice, 'gwei');
        
        return {
            slow: Math.floor(parseFloat(gasPriceGwei) * 0.8),
            standard: Math.floor(parseFloat(gasPriceGwei)),
            fast: Math.floor(parseFloat(gasPriceGwei) * 1.2)
        };
    } catch (error) {
        return {
            slow: 10,
            standard: 20,
            fast: 30
        };
    }
};

// Watch for account changes
export const watchAccountChanges = (callback) => {
    if (isMetaMaskInstalled()) {
        window.ethereum.on('accountsChanged', callback);
        return () => window.ethereum.removeListener('accountsChanged', callback);
    }
    return () => {};
};

// Watch for network changes
export const watchNetworkChanges = (callback) => {
    if (isMetaMaskInstalled()) {
        window.ethereum.on('chainChanged', callback);
        return () => window.ethereum.removeListener('chainChanged', callback);
    }
    return () => {};
};

// Switch network
export const switchNetwork = async (networkId) => {
    try {
        const network = NETWORKS[networkId];
        if (!network) {
            throw new Error('Unsupported network');
        }

        await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: network.chainId }],
        });
    } catch (error) {
        // If the network doesn't exist, add it
        if (error.code === 4902) {
            await addNetwork(networkId);
        } else {
            throw error;
        }
    }
};

// Add network to MetaMask
export const addNetwork = async (networkId) => {
    const network = NETWORKS[networkId];
    if (!network) {
        throw new Error('Unsupported network');
    }

    await window.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [{
            chainId: network.chainId,
            chainName: network.name,
            rpcUrls: [network.rpcUrl],
            blockExplorerUrls: [network.blockExplorer]
        }]
    });
};

// Calculate transaction fee
export const calculateTransactionFee = (gasUsed, gasPrice) => {
    try {
        const web3 = getWeb3Instance();
        const gasPriceWei = web3.utils.toWei(gasPrice.toString(), 'gwei');
        const feeWei = gasUsed * gasPriceWei;
        return web3.utils.fromWei(feeWei.toString(), 'ether');
    } catch (error) {
        return '0';
    }
};

export default {
    NETWORKS,
    isMetaMaskInstalled,
    getWeb3Instance,
    connectWallet,
    getBalance,
    getNetworkInfo,
    isValidAddress,
    ethToWei,
    weiToEth,
    gweiToWei,
    estimateGas,
    sendTransaction,
    getTransaction,
    getTransactionHistory,
    formatAddress,
    formatBalance,
    getGasPriceRecommendation,
    watchAccountChanges,
    watchNetworkChanges,
    switchNetwork,
    addNetwork,
    calculateTransactionFee
};
