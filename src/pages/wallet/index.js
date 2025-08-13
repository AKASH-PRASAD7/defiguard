import React, { useState, useEffect } from "react";
import Web3 from "web3";
import {
  Container,
  Row,
  Col,
  Card,
  Button,
  Form,
  Alert,
  Spinner,
  Table,
} from "react-bootstrap";
import Header from "../../components/header";
import Footer from "../../components/footer";
import "./index.css";

const Wallet = () => {
  const [web3, setWeb3] = useState(null);
  const [account, setAccount] = useState("");
  const [balance, setBalance] = useState("0");
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [connectLoading, setConnectLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [demoMode, setDemoMode] = useState(false);

  // Send ETH form state
  const [sendForm, setSendForm] = useState({
    recipient: "",
    amount: "",
    gasPrice: "20",
  });

  // Transaction history
  const [transactions, setTransactions] = useState([]);
  const [manualTransactions, setManualTransactions] = useState([]);

  // Network info
  const [networkId, setNetworkId] = useState(null);
  const [networkName, setNetworkName] = useState("");

  const networkNames = {
    1: "Ethereum Mainnet",
    3: "Ropsten Testnet",
    4: "Rinkeby Testnet",
    5: "Goerli Testnet",
    42: "Kovan Testnet",
    11155111: "Sepolia Testnet",
    1337: "Local Development",
  };

  // Initialize Web3 and connect to MetaMask
  const connectWallet = async () => {
    setConnectLoading(true);
    setError("");

    try {
      // Check if MetaMask is installed
      if (window.ethereum) {
        const web3Instance = new Web3(window.ethereum);

        // Request account access
        const accounts = await window.ethereum.request({
          method: "eth_requestAccounts",
        });

        if (accounts.length > 0) {
          setWeb3(web3Instance);
          setAccount(accounts[0]);
          setIsConnected(true);

          // Get network info
          const netId = await web3Instance.eth.net.getId();
          setNetworkId(netId);
          setNetworkName(networkNames[netId] || `Network ID: ${netId}`);

          // Get balance
          await getBalance(web3Instance, accounts[0]);

          // Get transaction history
          await getTransactionHistory(web3Instance, accounts[0]);

          setSuccess("Wallet connected successfully!");
        } else {
          throw new Error("No accounts found");
        }
      } else {
        throw new Error(
          "MetaMask is not installed. Please install MetaMask to use this wallet."
        );
      }
    } catch (err) {
      setError(err.message);
      console.error("Wallet connection error:", err);
    } finally {
      setConnectLoading(false);
    }
  };

  // Get ETH balance
  const getBalance = async (web3Instance = web3, address = account) => {
    try {
      const balanceWei = await web3Instance.eth.getBalance(address);
      const balanceEth = web3Instance.utils.fromWei(balanceWei, "ether");
      setBalance(parseFloat(balanceEth).toFixed(4));
    } catch (err) {
      console.error("Error getting balance:", err);
    }
  };

  // Get transaction history (last 10 transactions)
  const getTransactionHistory = async (
    web3Instance = web3,
    address = account
  ) => {
    try {
      //   console.log("Fetching transaction history for:", address);
      const latestBlock = await web3Instance.eth.getBlockNumber();
      //   console.log("Latest block:", latestBlock);
      const transactions = [];

      // Check last 1000 blocks for transactions (more for testnets)
      const blocksToCheck = Math.min(1000, latestBlock);
      //   console.log("Checking", blocksToCheck, "blocks");

      for (let i = 0; i < blocksToCheck && transactions.length < 10; i++) {
        const blockNumber = latestBlock - i;
        const block = await web3Instance.eth.getBlock(blockNumber, true);

        if (block && block.transactions) {
          block.transactions.forEach((tx) => {
            if (tx.from === address || tx.to === address) {
              //   console.log("Found transaction:", tx.hash);
              transactions.push({
                hash: tx.hash,
                from: tx.from,
                to: tx.to,
                value: web3Instance.utils.fromWei(tx.value, "ether"),
                blockNumber: tx.blockNumber,
                timestamp: new Date().toLocaleString(),
                type: tx.from === address ? "sent" : "received",
              });
            }
          });
        }
      }

      setTransactions(transactions.slice(0, 10));
    } catch (err) {
      console.error("Error getting transaction history:", err);
    }
  };

  // Send ETH transaction
  const sendTransaction = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const { recipient, amount, gasPrice } = sendForm;

      // Enhanced validation
      if (!recipient || recipient.trim() === "") {
        throw new Error("Please enter a recipient address");
      }

      if (!amount || amount === "" || parseFloat(amount) <= 0) {
        throw new Error("Please enter a valid amount greater than 0");
      }

      if (parseFloat(amount) > parseFloat(balance)) {
        throw new Error("Insufficient balance for this transaction");
      }

      if (!web3.utils.isAddress(recipient)) {
        throw new Error("Invalid recipient address format");
      }

      const amountWei = web3.utils.toWei(amount, "ether");
      const gasPriceWei = web3.utils.toWei(gasPrice, "gwei");

      // Estimate gas
      const gasLimit = await web3.eth.estimateGas({
        from: account,
        to: recipient,
        value: amountWei,
      });

      // Send transaction
      const tx = await web3.eth.sendTransaction({
        from: account,
        to: recipient,
        value: amountWei,
        gas: gasLimit,
        gasPrice: gasPriceWei,
      });

      setSuccess(`Transaction sent successfully! Hash: ${tx.transactionHash}`);

      // Manually add transaction to history immediately
      const newTx = {
        hash: tx.transactionHash,
        from: account,
        to: recipient,
        value: amount,
        blockNumber: "Pending",
        timestamp: new Date().toLocaleString(),
        type: "sent",
      };

      // Add to manual transactions list
      setManualTransactions((prev) => [newTx, ...prev.slice(0, 9)]);

      // Combine manual transactions with discovered transactions
      setTransactions((prev) => {
        const combined = [newTx, ...prev];
        // Remove duplicates by hash
        const unique = combined.filter(
          (tx, index, self) =>
            index === self.findIndex((t) => t.hash === tx.hash)
        );
        return unique.slice(0, 10);
      });

      // Reset form
      setSendForm({
        recipient: "",
        amount: "",
        gasPrice: "20",
      });

      // Refresh balance (non-blocking)
      setTimeout(async () => {
        try {
          await getBalance();
        } catch (refreshError) {
          console.error("Error refreshing balance:", refreshError);
        }
      }, 1000); // Wait 1 second for transaction to be mined
    } catch (err) {
      setError(err.message);
      console.error("Transaction error:", err);
    } finally {
      setLoading(false);
    }
  };

  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setSendForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // Demo mode functions
  const enterDemoMode = () => {
    setDemoMode(true);
    setAccount("0x742d35Cc6635Bc0532E3D7b2b9C24B2c5f07c9E7");
    setBalance("10.5000");
    setIsConnected(true);
    setNetworkName("Demo Network");
    setTransactions([
      {
        hash: "0xa1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456",
        from: "0x742d35Cc6635Bc0532E3D7b2b9C24B2c5f07c9E7",
        to: "0x123456789abcdef123456789abcdef123456789ab",
        value: "0.1",
        blockNumber: 18567890,
        timestamp: new Date().toLocaleString(),
        type: "sent",
      },
      {
        hash: "0xdef123456789abcdef123456789abcdef123456789abcdef123456789abcdef12",
        from: "0x987654321fedcba987654321fedcba9876543210",
        to: "0x742d35Cc6635Bc0532E3D7b2b9C24B2c5f07c9E7",
        value: "0.5",
        blockNumber: 18567845,
        timestamp: new Date(Date.now() - 300000).toLocaleString(),
        type: "received",
      },
    ]);
    setSuccess("Demo mode activated! This is a simulated wallet interface.");
  };

  // Disconnect wallet
  const disconnectWallet = () => {
    setWeb3(null);
    setAccount("");
    setBalance("0");
    setIsConnected(false);
    setDemoMode(false);
    setTransactions([]);
    setManualTransactions([]);
    setNetworkId(null);
    setNetworkName("");
    setConnectLoading(false); // Reset connect loading state
    setLoading(false); // Reset general loading state
    setError(""); // Clear any errors
    setSuccess("Wallet disconnected");
  };

  // Demo transaction
  const sendDemoTransaction = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const { recipient, amount } = sendForm;

      // Enhanced validation (same as real transaction)
      if (!recipient || recipient.trim() === "") {
        throw new Error("Please enter a recipient address");
      }

      if (!amount || amount === "" || parseFloat(amount) <= 0) {
        throw new Error("Please enter a valid amount greater than 0");
      }

      if (parseFloat(amount) > parseFloat(balance)) {
        throw new Error("Insufficient balance for this transaction");
      }

      // For demo, we can be less strict about address format
      if (recipient.length < 10) {
        throw new Error("Please enter a valid recipient address");
      }

      // Simulate transaction delay
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const demoTxHash = "0x" + Math.random().toString(16).substring(2, 66);
      setSuccess(`Demo transaction sent! Hash: ${demoTxHash}`);

      // Add demo transaction to history
      const newTx = {
        hash: demoTxHash,
        from: account,
        to: recipient,
        value: amount,
        blockNumber: 18567891,
        timestamp: new Date().toLocaleString(),
        type: "sent",
      };

      setTransactions((prev) => [newTx, ...prev.slice(0, 9)]);

      // Update demo balance
      const newBalance = (
        parseFloat(balance) -
        parseFloat(amount) -
        0.001
      ).toFixed(4);
      setBalance(newBalance);

      // Reset form
      setSendForm({
        recipient: "",
        amount: "",
        gasPrice: "20",
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle account changes
  useEffect(() => {
    if (window.ethereum) {
      window.ethereum.on("accountsChanged", (accounts) => {
        if (accounts.length === 0) {
          disconnectWallet();
        } else {
          setAccount(accounts[0]);
          if (web3) {
            getBalance(web3, accounts[0]);
            getTransactionHistory(web3, accounts[0]);
          }
        }
      });

      window.ethereum.on("chainChanged", () => {
        window.location.reload();
      });
    }

    return () => {
      if (window.ethereum) {
        window.ethereum.removeAllListeners("accountsChanged");
        window.ethereum.removeAllListeners("chainChanged");
      }
    };
  }, [web3]);

  // Auto-refresh balance every 30 seconds
  useEffect(() => {
    let interval;
    if (isConnected && web3 && account) {
      interval = setInterval(() => {
        getBalance();
      }, 30000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isConnected, web3, account]);

  return (
    <div>
      <div className="header_section">
        <Header />
      </div>
      <Container className="wallet-container pt-4 pb-5">
        <Row>
          <Col>
            <h1 className="wallet-title text-center mb-4">DefiGuard Wallet</h1>
            <p className="text-center text-muted mb-5">
              {isConnected
                ? demoMode
                  ? "Demo wallet interface - simulate transactions safely"
                  : "Manage your ETH transactions securely"
                : "Connect your MetaMask wallet to send and receive ETH"}
            </p>
          </Col>
        </Row>

        {/* Alerts */}
        {error && (
          <Row className="mb-3">
            <Col>
              <Alert variant="danger" onClose={() => setError("")} dismissible>
                {error}
              </Alert>
            </Col>
          </Row>
        )}

        {success && (
          <Row className="mb-3">
            <Col>
              <Alert
                variant="success"
                onClose={() => setSuccess("")}
                dismissible
              >
                {success}
              </Alert>
            </Col>
          </Row>
        )}

        {!isConnected ? (
          /* Connection Section */
          <>
            <Row className="justify-content-center mb-4">
              <Col md={8}>
                <Card className="wallet-card">
                  <Card.Body className="text-center">
                    <Card.Title>Connect Your Wallet</Card.Title>
                    <Card.Text>
                      Connect your MetaMask wallet to start using the DefiGuard
                      wallet interface.
                    </Card.Text>
                    <div className="d-grid gap-3">
                      <Button
                        variant="primary"
                        size="lg"
                        onClick={connectWallet}
                        disabled={connectLoading}
                      >
                        {connectLoading ? (
                          <>
                            <Spinner
                              as="span"
                              animation="border"
                              size="sm"
                              role="status"
                              aria-hidden="true"
                              className="me-2"
                            />
                            Connecting...
                          </>
                        ) : (
                          "Connect MetaMask"
                        )}
                      </Button>
                      <Button
                        variant="outline-info"
                        size="sm"
                        onClick={enterDemoMode}
                      >
                        View Demo Interface
                      </Button>
                    </div>
                  </Card.Body>
                </Card>
              </Col>
            </Row>

            {/* MetaMask Installation Guide */}
            <Row className="justify-content-center">
              <Col md={10}>
                <Card className="wallet-card">
                  <Card.Body>
                    <Card.Title className="text-center mb-4">
                      <i className="fas fa-download me-2"></i>
                      Install MetaMask
                    </Card.Title>
                    <Row>
                      <Col md={6}>
                        <h5>
                          <i className="fas fa-step-forward me-2"></i>Step 1:
                          Download MetaMask
                        </h5>
                        <p>
                          MetaMask is a browser extension wallet that allows you
                          to interact with Ethereum.
                        </p>
                        <div className="mb-3">
                          <Button
                            variant="success"
                            href="https://metamask.io/download/"
                            target="_blank"
                            size="lg"
                            className="me-2 mb-3"
                          >
                            <i className="fab fa-chrome me-2"></i>
                            Download for Chrome
                          </Button>
                          <Button
                            variant="outline-success"
                            href="https://metamask.io/download/"
                            target="_blank"
                            size="lg"
                          >
                            <i className="fab fa-firefox me-2"></i>
                            Other Browsers
                          </Button>
                        </div>
                      </Col>
                      <Col md={6}>
                        <h5>
                          <i className="fas fa-cogs me-2"></i>Step 2: Setup
                          MetaMask
                        </h5>
                        <ul className="list-unstyled">
                          <li>
                            <i className="fas fa-check text-success me-2"></i>
                            Create a new wallet or import existing
                          </li>
                          <li>
                            <i className="fas fa-check text-success me-2"></i>
                            Secure your seed phrase
                          </li>
                          <li>
                            <i className="fas fa-check text-success me-2"></i>
                            Connect to Ethereum networks
                          </li>
                          <li>
                            <i className="fas fa-check text-success me-2"></i>
                            Get test ETH from faucets
                          </li>
                        </ul>
                        <Alert variant="info" className="mt-3">
                          <small>
                            <i className="fas fa-info-circle me-2"></i>
                            <strong>Need test ETH?</strong> Get free test tokens
                            from:
                            <br />
                            <a
                              href="https://sepoliafaucet.com"
                              target="_blank"
                              rel="noreferrer"
                            >
                              Sepolia Faucet
                            </a>{" "}
                            |
                            <a
                              href="https://goerlifaucet.com"
                              target="_blank"
                              rel="noreferrer"
                              className="ms-2"
                            >
                              Goerli Faucet
                            </a>
                          </small>
                        </Alert>
                      </Col>
                    </Row>

                    <hr className="my-4" />

                    <Row>
                      <Col md={12}>
                        <h5 className="text-center mb-3">
                          <i className="fas fa-shield-alt me-2 text-warning"></i>
                          Security Tips
                        </h5>
                        <Row>
                          <Col md={4}>
                            <div className="text-center">
                              <i className="fas fa-lock fa-2x text-primary mb-2"></i>
                              <h6>Keep Your Seed Phrase Safe</h6>
                              <small className="text-muted">
                                Never share your 12-word recovery phrase with
                                anyone.
                              </small>
                            </div>
                          </Col>
                          <Col md={4}>
                            <div className="text-center">
                              <i className="fas fa-globe fa-2x text-success mb-2"></i>
                              <h6>Verify Websites</h6>
                              <small className="text-muted">
                                Always check URLs before connecting your wallet.
                              </small>
                            </div>
                          </Col>
                          <Col md={4}>
                            <div className="text-center">
                              <i className="fas fa-sync fa-2x text-info mb-2"></i>
                              <h6>Keep Updated</h6>
                              <small className="text-muted">
                                Always use the latest version of MetaMask.
                              </small>
                            </div>
                          </Col>
                        </Row>
                      </Col>
                    </Row>
                  </Card.Body>
                </Card>
              </Col>
            </Row>
          </>
        ) : (
          /* Wallet Interface */
          <>
            {/* Wallet Info Section */}
            <Row className="mb-4">
              <Col md={6}>
                <Card className="wallet-card">
                  <Card.Body>
                    <Card.Title>Wallet Information</Card.Title>
                    <div className="wallet-info">
                      <p>
                        <strong>Address:</strong>
                      </p>
                      <p className="address">{account}</p>
                      <p>
                        <strong>Balance:</strong> {balance} ETH
                      </p>
                      <p>
                        <strong>Network:</strong> {networkName}
                      </p>
                    </div>
                    <Button
                      variant="outline-secondary"
                      size="sm"
                      onClick={disconnectWallet}
                    >
                      Disconnect
                    </Button>
                  </Card.Body>
                </Card>
              </Col>

              {/* Quick Actions */}
              <Col md={6}>
                <Card className="wallet-card">
                  <Card.Body>
                    <Card.Title>Quick Actions</Card.Title>
                    <div className="d-grid gap-2">
                      <Button
                        variant="success"
                        onClick={() => getBalance()}
                        disabled={loading}
                      >
                        Refresh Balance
                      </Button>
                      <Button
                        variant="info"
                        onClick={() => getTransactionHistory()}
                        disabled={loading}
                      >
                        Refresh Transactions
                      </Button>
                      <Button
                        variant="outline-primary"
                        onClick={() => navigator.clipboard.writeText(account)}
                      >
                        Copy Address
                      </Button>
                    </div>
                  </Card.Body>
                </Card>
              </Col>
            </Row>

            {/* Send ETH Section */}
            <Row className="mb-4">
              <Col md={8} className="mx-auto">
                <Card className="wallet-card">
                  <Card.Body>
                    <Card.Title>Send ETH</Card.Title>
                    {demoMode && (
                      <Alert variant="warning" className="mb-3">
                        <i className="fas fa-info-circle me-2"></i>
                        <strong>Demo Mode:</strong> This is a simulated wallet
                        interface. No real transactions will be sent.
                      </Alert>
                    )}
                    <Form
                      onSubmit={
                        demoMode ? sendDemoTransaction : sendTransaction
                      }
                    >
                      <Row>
                        <Col md={12}>
                          <Form.Group className="mb-3">
                            <Form.Label>Recipient Address</Form.Label>
                            <Form.Control
                              type="text"
                              name="recipient"
                              value={sendForm.recipient}
                              onChange={handleInputChange}
                              placeholder="0x..."
                              required
                            />
                          </Form.Group>
                        </Col>
                      </Row>
                      <Row>
                        <Col md={6}>
                          <Form.Group className="mb-3">
                            <Form.Label>Amount (ETH)</Form.Label>
                            <Form.Control
                              type="number"
                              name="amount"
                              value={sendForm.amount}
                              onChange={handleInputChange}
                              placeholder="0.0"
                              step="0.0001"
                              min="0"
                              required
                            />
                          </Form.Group>
                        </Col>
                        <Col md={6}>
                          <Form.Group className="mb-3">
                            <Form.Label>Gas Price (GWEI)</Form.Label>
                            <Form.Control
                              type="number"
                              name="gasPrice"
                              value={sendForm.gasPrice}
                              onChange={handleInputChange}
                              placeholder="20"
                              min="1"
                            />
                          </Form.Group>
                        </Col>
                      </Row>
                      <div className="d-grid">
                        <Button
                          variant="primary"
                          type="submit"
                          disabled={loading}
                          size="lg"
                        >
                          {loading ? (
                            <>
                              <Spinner
                                as="span"
                                animation="border"
                                size="sm"
                                role="status"
                                aria-hidden="true"
                                className="me-2"
                              />
                              Sending...
                            </>
                          ) : (
                            "Send ETH"
                          )}
                        </Button>
                      </div>
                    </Form>
                  </Card.Body>
                </Card>
              </Col>
            </Row>

            {/* Transaction History Section */}
            <Row>
              <Col>
                <Card className="wallet-card">
                  <Card.Body>
                    <Card.Title>Recent Transactions</Card.Title>
                    {transactions.length > 0 ? (
                      <Table responsive striped>
                        <thead>
                          <tr>
                            <th>Type</th>
                            <th>Hash</th>
                            <th>From/To</th>
                            <th>Amount (ETH)</th>
                            <th>Block</th>
                          </tr>
                        </thead>
                        <tbody>
                          {transactions.map((tx, index) => (
                            <tr key={index}>
                              <td>
                                <span
                                  className={`badge ${
                                    tx.type === "sent"
                                      ? "bg-danger"
                                      : "bg-success"
                                  }`}
                                >
                                  {tx.type.toUpperCase()}
                                </span>
                              </td>
                              <td>
                                <span className="tx-hash">
                                  {tx.hash.substring(0, 10)}...
                                </span>
                              </td>
                              <td>
                                <span className="address">
                                  {tx.type === "sent"
                                    ? `${tx.to.substring(0, 8)}...`
                                    : `${tx.from.substring(0, 8)}...`}
                                </span>
                              </td>
                              <td>{parseFloat(tx.value).toFixed(4)}</td>
                              <td>{tx.blockNumber}</td>
                            </tr>
                          ))}
                        </tbody>
                      </Table>
                    ) : (
                      <p className="text-muted">
                        No recent transactions found.
                      </p>
                    )}
                  </Card.Body>
                </Card>
              </Col>
            </Row>
          </>
        )}
      </Container>
      <Footer />
    </div>
  );
};

export default Wallet;
