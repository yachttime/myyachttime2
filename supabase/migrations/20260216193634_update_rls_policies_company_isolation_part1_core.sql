/*
  # Update RLS Policies for Company Isolation - Part 1: Core Tables

  1. Tables Updated
    - yachts
    - customers
    - customer_vessels
    - yacht_bookings
    - yacht_booking_owners

  2. Policy Pattern
    - DROP all existing policies
    - CREATE new policies with company isolation:
      - Master users can access all companies
      - Regular users can only access their company's data
      - Format: (is_master_user() OR company_id = get_user_company_id())

  3. Policy Types
    - SELECT: View data
    - INSERT: Create new records
    - UPDATE: Modify existing records
    - DELETE: Remove records

  4. Notes
    - Complete data isolation between companies
    - Master users bypass company restrictions
    - Preserves existing role-based permissions where applicable
*/

-- YACHTS TABLE
-- Drop existing policies
DROP POLICY IF EXISTS "Staff can view all yachts" ON yachts;
DROP POLICY IF EXISTS "Users can view all yachts" ON yachts;
DROP POLICY IF EXISTS "Staff can insert yachts" ON yachts;
DROP POLICY IF EXISTS "Staff can update yachts" ON yachts;
DROP POLICY IF EXISTS "Staff can delete yachts" ON yachts;
DROP POLICY IF EXISTS "Master and staff can view all yachts" ON yachts;
DROP POLICY IF EXISTS "Master and staff can insert yachts" ON yachts;
DROP POLICY IF EXISTS "Master and staff can update yachts" ON yachts;
DROP POLICY IF EXISTS "Master and staff can delete yachts" ON yachts;

-- Create new company-isolated policies
CREATE POLICY "Users can view company yachts"
  ON yachts
  FOR SELECT
  TO authenticated
  USING (
    is_master_user() OR 
    company_id = get_user_company_id()
  );

CREATE POLICY "Staff can insert company yachts"
  ON yachts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (is_master_user() OR company_id = get_user_company_id()) AND
    is_staff()
  );

CREATE POLICY "Staff can update company yachts"
  ON yachts
  FOR UPDATE
  TO authenticated
  USING (
    (is_master_user() OR company_id = get_user_company_id()) AND
    is_staff()
  )
  WITH CHECK (
    (is_master_user() OR company_id = get_user_company_id()) AND
    is_staff()
  );

CREATE POLICY "Staff can delete company yachts"
  ON yachts
  FOR DELETE
  TO authenticated
  USING (
    (is_master_user() OR company_id = get_user_company_id()) AND
    is_staff()
  );

-- CUSTOMERS TABLE
-- Drop existing policies
DROP POLICY IF EXISTS "Staff and mechanics can view all customers" ON customers;
DROP POLICY IF EXISTS "Staff and mechanics can insert customers" ON customers;
DROP POLICY IF EXISTS "Staff and mechanics can update customers" ON customers;
DROP POLICY IF EXISTS "Staff and mechanics can delete customers" ON customers;

-- Create new company-isolated policies
CREATE POLICY "Users can view company customers"
  ON customers
  FOR SELECT
  TO authenticated
  USING (
    is_master_user() OR 
    company_id = get_user_company_id()
  );

CREATE POLICY "Staff can insert company customers"
  ON customers
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (is_master_user() OR company_id = get_user_company_id()) AND
    is_staff()
  );

CREATE POLICY "Staff can update company customers"
  ON customers
  FOR UPDATE
  TO authenticated
  USING (
    (is_master_user() OR company_id = get_user_company_id()) AND
    is_staff()
  )
  WITH CHECK (
    (is_master_user() OR company_id = get_user_company_id()) AND
    is_staff()
  );

CREATE POLICY "Staff can delete company customers"
  ON customers
  FOR DELETE
  TO authenticated
  USING (
    (is_master_user() OR company_id = get_user_company_id()) AND
    is_staff()
  );

-- CUSTOMER_VESSELS TABLE
-- Drop existing policies
DROP POLICY IF EXISTS "Master users can view all customer vessels" ON customer_vessels;
DROP POLICY IF EXISTS "Staff and mechanics can view company customer vessels" ON customer_vessels;
DROP POLICY IF EXISTS "Master users can insert customer vessels" ON customer_vessels;
DROP POLICY IF EXISTS "Staff and mechanics can insert customer vessels" ON customer_vessels;
DROP POLICY IF EXISTS "Master users can update customer vessels" ON customer_vessels;
DROP POLICY IF EXISTS "Staff and mechanics can update customer vessels" ON customer_vessels;
DROP POLICY IF EXISTS "Master users can delete customer vessels" ON customer_vessels;
DROP POLICY IF EXISTS "Staff and mechanics can delete customer vessels" ON customer_vessels;

-- Create new company-isolated policies
CREATE POLICY "Users can view company customer vessels"
  ON customer_vessels
  FOR SELECT
  TO authenticated
  USING (
    is_master_user() OR 
    company_id = get_user_company_id()
  );

CREATE POLICY "Staff can insert company customer vessels"
  ON customer_vessels
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (is_master_user() OR company_id = get_user_company_id()) AND
    is_staff()
  );

CREATE POLICY "Staff can update company customer vessels"
  ON customer_vessels
  FOR UPDATE
  TO authenticated
  USING (
    (is_master_user() OR company_id = get_user_company_id()) AND
    is_staff()
  )
  WITH CHECK (
    (is_master_user() OR company_id = get_user_company_id()) AND
    is_staff()
  );

CREATE POLICY "Staff can delete company customer vessels"
  ON customer_vessels
  FOR DELETE
  TO authenticated
  USING (
    (is_master_user() OR company_id = get_user_company_id()) AND
    is_staff()
  );

-- YACHT_BOOKINGS TABLE
-- Drop existing policies
DROP POLICY IF EXISTS "Users can view all bookings" ON yacht_bookings;
DROP POLICY IF EXISTS "Staff can view all yacht bookings" ON yacht_bookings;
DROP POLICY IF EXISTS "Users can create bookings for their yacht" ON yacht_bookings;
DROP POLICY IF EXISTS "Staff can insert yacht bookings" ON yacht_bookings;
DROP POLICY IF EXISTS "Users can update their bookings" ON yacht_bookings;
DROP POLICY IF EXISTS "Staff can update yacht bookings" ON yacht_bookings;
DROP POLICY IF EXISTS "Users can delete their bookings" ON yacht_bookings;
DROP POLICY IF EXISTS "Staff can delete yacht bookings" ON yacht_bookings;

-- Create new company-isolated policies
CREATE POLICY "Users can view company bookings"
  ON yacht_bookings
  FOR SELECT
  TO authenticated
  USING (
    is_master_user() OR 
    company_id = get_user_company_id() OR
    user_id = auth.uid()
  );

CREATE POLICY "Users can insert company bookings"
  ON yacht_bookings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    is_master_user() OR 
    company_id = get_user_company_id()
  );

CREATE POLICY "Users can update company bookings"
  ON yacht_bookings
  FOR UPDATE
  TO authenticated
  USING (
    is_master_user() OR 
    company_id = get_user_company_id() OR
    user_id = auth.uid()
  )
  WITH CHECK (
    is_master_user() OR 
    company_id = get_user_company_id() OR
    user_id = auth.uid()
  );

CREATE POLICY "Users can delete company bookings"
  ON yacht_bookings
  FOR DELETE
  TO authenticated
  USING (
    is_master_user() OR 
    (company_id = get_user_company_id() AND is_staff()) OR
    user_id = auth.uid()
  );

-- YACHT_BOOKING_OWNERS TABLE
-- Drop existing policies
DROP POLICY IF EXISTS "Users can view all booking owners" ON yacht_booking_owners;
DROP POLICY IF EXISTS "Staff can view all booking owners" ON yacht_booking_owners;
DROP POLICY IF EXISTS "Users can insert booking owners" ON yacht_booking_owners;
DROP POLICY IF EXISTS "Staff can insert booking owners" ON yacht_booking_owners;
DROP POLICY IF EXISTS "Users can update booking owners" ON yacht_booking_owners;
DROP POLICY IF EXISTS "Staff can update booking owners" ON yacht_booking_owners;
DROP POLICY IF EXISTS "Users can delete booking owners" ON yacht_booking_owners;
DROP POLICY IF EXISTS "Staff can delete booking owners" ON yacht_booking_owners;

-- Create new company-isolated policies
CREATE POLICY "Users can view company booking owners"
  ON yacht_booking_owners
  FOR SELECT
  TO authenticated
  USING (
    is_master_user() OR 
    company_id = get_user_company_id()
  );

CREATE POLICY "Staff can insert company booking owners"
  ON yacht_booking_owners
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (is_master_user() OR company_id = get_user_company_id()) AND
    is_staff()
  );

CREATE POLICY "Staff can update company booking owners"
  ON yacht_booking_owners
  FOR UPDATE
  TO authenticated
  USING (
    (is_master_user() OR company_id = get_user_company_id()) AND
    is_staff()
  )
  WITH CHECK (
    (is_master_user() OR company_id = get_user_company_id()) AND
    is_staff()
  );

CREATE POLICY "Staff can delete company booking owners"
  ON yacht_booking_owners
  FOR DELETE
  TO authenticated
  USING (
    (is_master_user() OR company_id = get_user_company_id()) AND
    is_staff()
  );
