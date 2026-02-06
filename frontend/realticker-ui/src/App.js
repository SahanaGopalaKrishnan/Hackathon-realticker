import React, { useState } from "react";
import { Container, Row, Col, Navbar, Nav } from 'react-bootstrap';
import StockTable from "./components/StockTable";
import StockDetail from "./components/StockDetail";

import './App.css';

function App() {
  const [selectedTicker, setSelectedTicker] = useState(null);
  const [page, setPage] = useState('home'); 

  return (
    <>
      <Navbar bg="primary" variant="dark" expand="lg" className="fixed-top shadow-sm">
        <Container>
          <Navbar.Brand href="#" onClick={() => { setPage('home'); setSelectedTicker(null); }}>RealTicker</Navbar.Brand>
          <Navbar.Toggle aria-controls="main-nav" />
          <Navbar.Collapse id="main-nav">
            <Nav className="ms-auto">
              <Nav.Link href="#" onClick={() => setPage('home')}>Home</Nav.Link>
  
            </Nav>
          </Navbar.Collapse>
        </Container>
      </Navbar>

      <div className="main-content">
        <Container>
          {page === 'home' && (
            <>
              <div className="hero p-3 rounded mb-4 bg-light border">
                <h1 className="h4 mb-1">RealTicker — AI-Powered Stock Insights</h1>
                <p className="mb-0 text-muted">Click a row to view 6 months history and AI-generated investment insights. <span className="text-danger">Not financial advice.</span></p>
              </div>

              <Row>
                <Col lg={7} md={12} className="mb-3">
                  <StockTable onSelectStock={setSelectedTicker} />
                </Col>
                <Col lg={5} md={12} className="mb-3">
                  <StockDetail ticker={selectedTicker} />
                </Col>
              </Row>
            </>
          )}

          {page === 'about' && (
            <Row>
              <Col md={12} className="mb-3">
              </Col>
            </Row>
          )}
        </Container>
      </div>

      <footer className="fixed-bottom bg-white border-top py-2 ">
        <Container className="text-center small text-muted ">
          © {new Date().getFullYear()} RealTicker — AI-generated insights are not financial advice.
        </Container>
      </footer>
    </>
  );
}

export default App;
